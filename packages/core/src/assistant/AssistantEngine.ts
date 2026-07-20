import {
  IAssistantEngine,
  IIntentParser,
  IEntityExtractor,
  ISlotFiller,
  ICommandPlanner,
  IConversationManager,
  IResponseGenerator,
  IContextResolver,
  ISessionManager,
  IAssistantReporter
} from "./interfaces";
import { AssistantState } from "./AssistantState";
import { IntentType } from "./IntentType";
import { CommandType } from "./CommandType";
import { EntityType } from "./EntityType";
import { ResponseType } from "./ResponseType";
import { PlannerState } from "./PlannerState";
import { ConversationState } from "./ConversationState";
import { ConfidenceLevel } from "./ConfidenceLevel";
import {
  Conversation,
  ConversationMessage,
  ConversationHistory,
  ConversationContext,
  Intent,
  ParsedIntent,
  Entity,
  Slot,
  Parameter,
  ExecutionPlan,
  ExecutionStep,
  PlannerReport,
  PlannerSnapshot,
  Assistant,
  AssistantRequest,
  AssistantResponse,
  AssistantSession,
  AssistantStatistics,
  ConversationMemory,
  PromptContext,
  UserPreferences,
  ExecutionResult,
  AssistantReport,
  AssistantSnapshot,
  AssistantStateSnapshot
} from "./models";
import {
  AssistantException,
  IntentParserException,
  PlannerException,
  SessionNotFoundException,
  AssistantValidationException,
  InvalidAssistantStateException,
  deepFreeze
} from "./types";
import { AssistantValidator } from "./AssistantValidator";

export class AssistantEngine implements IAssistantEngine {
  private _state = AssistantState.CREATED;
  private readonly _eventHandlers = new Map<string, Set<(event: any) => void>>();

  // Sub-components
  private readonly _intentParser: IntentParserImpl;
  private readonly _entityExtractor: EntityExtractorImpl;
  private readonly _slotFiller: SlotFillerImpl;
  private readonly _planner: CommandPlannerImpl;
  private readonly _conversationManager: ConversationManagerImpl;
  private readonly _responseGenerator: ResponseGeneratorImpl;
  private readonly _contextResolver: ContextResolverImpl;
  private readonly _sessionManager: SessionManagerImpl;
  private readonly _reporter: AssistantReporterImpl;

  private _commandsProcessed = 0;
  private _successfulCommands = 0;
  private _totalResponseTimeMs = 0;
  private _bootTime = Date.now();

  constructor(
    private readonly _context: any,
    private readonly _preferences: UserPreferences
  ) {
    this._intentParser = new IntentParserImpl(this);
    this._entityExtractor = new EntityExtractorImpl(this);
    this._slotFiller = new SlotFillerImpl(this);
    this._planner = new CommandPlannerImpl(this);
    this._conversationManager = new ConversationManagerImpl(this);
    this._responseGenerator = new ResponseGeneratorImpl(this);
    this._contextResolver = new ContextResolverImpl(this);
    this._sessionManager = new SessionManagerImpl(this);
    this._reporter = new AssistantReporterImpl(this);
  }

  // --- IAssistantEngine implementation ---

  public async initialize(): Promise<void> {
    if (this._state === AssistantState.FAILED || this._state === AssistantState.RESPONDING) {
      this._state = AssistantState.CREATED;
    }
    if (this._state !== AssistantState.CREATED) {
      throw new InvalidAssistantStateException("initialize", this._state);
    }
    this._state = AssistantState.INITIALIZING;
    await this.logToMemory("assistant", "initialize_start", { timestamp: new Date() });

    try {
      // Create a default session on initialize
      await this._sessionManager.createSession();
      this._state = AssistantState.LISTENING;
      await this.logToMemory("assistant", "initialize_success", { timestamp: new Date() });
    } catch (err: any) {
      this._state = AssistantState.FAILED;
      await this.logToMemory("assistant", "initialize_failed", { timestamp: new Date(), error: err.message });
      throw new AssistantException(`Assistant initialization failed: ${err.message}`);
    }
  }

  public async start(): Promise<void> {
    if (this._state !== AssistantState.LISTENING) {
      throw new InvalidAssistantStateException("start", this._state);
    }
    this.emit("AssistantStarted", { timestamp: new Date() });
    await this.logToMemory("assistant", "start_success", { timestamp: new Date() });
  }

  public async stop(): Promise<void> {
    this._state = AssistantState.RESPONDING;
    // Archive or clean up sessions
    const sessions = await this._sessionManager.listSessions();
    for (const s of sessions) {
      await this._sessionManager.closeSession(s.id);
    }
    this._state = AssistantState.FAILED; // Stopped
    await this.logToMemory("assistant", "stop_success", { timestamp: new Date() });
  }

  public getState(): AssistantState {
    return this._state;
  }

  public async processCommand(command: string, sessionId?: string): Promise<AssistantResponse> {
    const startTime = Date.now();
    AssistantValidator.validateCommandSyntax(command);
    this._state = AssistantState.PROCESSING;

    // Resolve Session
    let activeSession: AssistantSession;
    if (sessionId) {
      activeSession = await this._sessionManager.getSession(sessionId);
    } else {
      const activeSessions = await this._sessionManager.listSessions();
      if (activeSessions.length > 0) {
        activeSession = activeSessions[0];
      } else {
        activeSession = await this._sessionManager.createSession();
      }
    }

    try {
      // 1. Intent Parsing
      const parsedIntent = await this._intentParser.parseIntent(command);
      this.emit("IntentParsed", { parsedIntent });
      await this.logToMemory("intent", `intent-${Date.now()}`, parsedIntent);

      // 2. Entity Extraction
      const entities = await this._entityExtractor.extractEntities(command);
      parsedIntent.entities = entities;
      this.emit("EntitiesExtracted", { command, entities });

      // 3. Slot Filling
      const slots = await this._slotFiller.fillSlots(parsedIntent, command);
      parsedIntent.slots = slots;
      AssistantValidator.validateRequiredSlots(slots);

      // Save parsed intent inside session context
      activeSession.context.lastParsedIntent = parsedIntent;
      activeSession.updatedAt = new Date();

      // 4. Planning
      this._state = AssistantState.PLANNING;
      const plan = await this._planner.createPlan(parsedIntent);
      this.emit("PlanCreated", { plan });

      // 5. Execution
      this._state = AssistantState.EXECUTING;
      this.emit("ExecutionStarted", { planId: plan.id });
      const execResult = await this._planner.executePlan(plan);
      
      if (execResult.success) {
        this.emit("ExecutionCompleted", { planId: plan.id });
        this._successfulCommands++;
      } else {
        this.emit("ExecutionFailed", { planId: plan.id, error: execResult.error });
      }

      // 6. Response Generation
      this._state = AssistantState.RESPONDING;
      const outputType = this._preferences.defaultOutputFormat;
      const response = await this._responseGenerator.generateResponse(execResult, outputType, plan);
      response.sessionId = activeSession.id;

      this.emit("ResponseGenerated", { response });

      // Save response in history
      await this._conversationManager.appendMessage(activeSession.id, {
        id: `msg-usr-${Date.now()}`,
        role: "user",
        content: command,
        timestamp: new Date()
      });
      await this._conversationManager.appendMessage(activeSession.id, {
        id: `msg-ast-${Date.now()}`,
        role: "assistant",
        content: response.text,
        timestamp: new Date()
      });

      this._commandsProcessed++;
      this._totalResponseTimeMs += (Date.now() - startTime);
      this._state = AssistantState.LISTENING;

      // Decision engine outcome logging
      if (this._context.decisionEngine && typeof this._context.decisionEngine.recordOutcome === "function") {
        await this._context.decisionEngine.recordOutcome({
          id: `assistant-command-outcome-${Date.now()}`,
          decisionId: "assistant-commands",
          chosenOptionId: parsedIntent.intent.type,
          score: execResult.success ? 1.0 : 0.0,
          metrics: { responseTimeMs: Date.now() - startTime },
          timestamp: new Date()
        });
      }

      return response;
    } catch (err: any) {
      this._state = AssistantState.LISTENING;
      this._commandsProcessed++;
      this._totalResponseTimeMs += (Date.now() - startTime);

      const errorResponse: AssistantResponse = {
        requestId: `req-err-${Date.now()}`,
        sessionId: activeSession.id,
        text: `Error executing command: ${err.message}`,
        type: ResponseType.ERROR,
        error: err.message,
        timestamp: new Date()
      };
      return errorResponse;
    }
  }

  public getIntentParser(): IIntentParser {
    return this._intentParser;
  }

  public getEntityExtractor(): IEntityExtractor {
    return this._entityExtractor;
  }

  public getSlotFiller(): ISlotFiller {
    return this._slotFiller;
  }

  public getPlanner(): ICommandPlanner {
    return this._planner;
  }

  public getConversationManager(): IConversationManager {
    return this._conversationManager;
  }

  public getResponseGenerator(): IResponseGenerator {
    return this._responseGenerator;
  }

  public getContextResolver(): IContextResolver {
    return this._contextResolver;
  }

  public getSessionManager(): ISessionManager {
    return this._sessionManager;
  }

  public getReporter(): IAssistantReporter {
    return this._reporter;
  }

  public getContext(): any {
    return this._context;
  }

  public on(event: string, handler: (payload: any) => void): void {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event)!.add(handler);
  }

  public off(event: string, handler: (payload: any) => void): void {
    if (this._eventHandlers.has(event)) {
      this._eventHandlers.get(event)!.delete(handler);
    }
  }

  public emit(event: string, payload?: any): void {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      for (const h of handlers) {
        try {
          h(payload);
        } catch {
          // suppress handler errors
        }
      }
    }
    this.logToMemory("assistant-events", `event-${Date.now()}`, { event, payload }).catch(() => {});
  }

  public async logToMemory(namespace: string, key: string, value: any): Promise<void> {
    if (this._context.memoryStore && typeof this._context.memoryStore.set === "function") {
      try {
        await this._context.memoryStore.set(namespace, key, value);
      } catch {
        // suppress memory errors
      }
    }
  }

  // Statistics properties
  public getCommandsProcessed() { return this._commandsProcessed; }
  public getSuccessfulCommands() { return this._successfulCommands; }
  public getAverageResponseTimeMs() { 
    return this._commandsProcessed > 0 ? this._totalResponseTimeMs / this._commandsProcessed : 0; 
  }
  public getUptimeMs() { return Date.now() - this._bootTime; }
}

// ─── Intent Parser Implementation ──────────────────────────────────────────────

class IntentParserImpl implements IIntentParser {
  constructor(private readonly engine: AssistantEngine) {}

  public async parseIntent(text: string): Promise<ParsedIntent> {
    const textLower = text.toLowerCase();
    let type = IntentType.UNKNOWN;
    let command = CommandType.HELP;
    let confidence = 0.5;

    // Pattern matching intents
    if (textLower.includes("create") && textLower.includes("channel")) {
      type = IntentType.CHANNEL;
      command = CommandType.CREATE;
      confidence = 0.95;
    } else if (textLower.includes("research")) {
      type = IntentType.RESEARCH;
      command = CommandType.RUN;
      confidence = 0.92;
    } else if (textLower.includes("generate") && textLower.includes("shorts")) {
      type = IntentType.GENERATION;
      command = CommandType.CREATE;
      confidence = 0.9;
    } else if (textLower.includes("script")) {
      type = IntentType.SCRIPT;
      command = CommandType.CREATE;
      confidence = 0.95;
    } else if (textLower.includes("generate") && textLower.includes("images")) {
      type = IntentType.GENERATION;
      command = CommandType.RUN;
      confidence = 0.88;
    } else if (textLower.includes("render")) {
      type = IntentType.RENDERING;
      command = CommandType.RUN;
      confidence = 0.94;
    } else if (textLower.includes("upload")) {
      type = IntentType.PUBLISHING;
      command = CommandType.CREATE;
      confidence = 0.85;
    } else if (textLower.includes("workspace") && textLower.includes("status")) {
      type = IntentType.WORKSPACE;
      command = CommandType.STATUS;
      confidence = 0.96;
    } else if (textLower.includes("optimize")) {
      type = IntentType.OPTIMIZATION;
      command = CommandType.OPTIMIZE;
      confidence = 0.9;
    } else if (textLower.includes("pause")) {
      type = IntentType.PIPELINE;
      command = CommandType.PAUSE;
      confidence = 0.95;
    } else if (textLower.includes("resume")) {
      type = IntentType.PIPELINE;
      command = CommandType.RESUME;
      confidence = 0.95;
    } else if (textLower.includes("cancel") && textLower.includes("rendering")) {
      type = IntentType.RENDERING;
      command = CommandType.STOP;
      confidence = 0.92;
    } else if (textLower.includes("analytics")) {
      type = IntentType.ANALYTICS;
      command = CommandType.STATUS;
      confidence = 0.91;
    } else if (textLower.includes("backup")) {
      type = IntentType.WORKSPACE;
      command = CommandType.RUN;
      confidence = 0.97;
    } else if (textLower.includes("restore")) {
      type = IntentType.WORKSPACE;
      command = CommandType.RUN;
      confidence = 0.96;
    } else if (textLower.includes("gpu") || textLower.includes("usage")) {
      type = IntentType.SYSTEM;
      command = CommandType.STATUS;
      confidence = 0.98;
    } else if (textLower.includes("create") && textLower.includes("project")) {
      type = IntentType.WORKSPACE;
      command = CommandType.CREATE;
      confidence = 0.95;
    } else if (textLower.includes("export")) {
      type = IntentType.WORKSPACE;
      command = CommandType.EXPORT;
      confidence = 0.89;
    } else if (textLower.includes("publish")) {
      type = IntentType.PUBLISHING;
      command = CommandType.RUN;
      confidence = 0.93;
    } else if (textLower.includes("analyze")) {
      type = IntentType.ANALYTICS;
      command = CommandType.ANALYZE;
      confidence = 0.9;
    }

    return {
      rawText: text,
      intent: { type, command, confidence },
      entities: [],
      slots: [],
      parameters: [],
      confidence: confidence >= 0.9 ? ConfidenceLevel.VERY_HIGH : ConfidenceLevel.MEDIUM
    };
  }
}

// ─── Entity Extractor Implementation ───────────────────────────────────────────

class EntityExtractorImpl implements IEntityExtractor {
  constructor(private readonly engine: AssistantEngine) {}

  public async extractEntities(text: string): Promise<Entity[]> {
    const textLower = text.toLowerCase();
    const entities: Entity[] = [];

    // Simple regex entity matchers
    if (textLower.includes("youtube")) {
      entities.push({
        value: "YouTube",
        type: EntityType.CHANNEL,
        startIndex: textLower.indexOf("youtube"),
        endIndex: textLower.indexOf("youtube") + 7,
        confidence: 0.99
      });
    }

    if (textLower.includes("rumble")) {
      entities.push({
        value: "Rumble",
        type: EntityType.CHANNEL,
        startIndex: textLower.indexOf("rumble"),
        endIndex: textLower.indexOf("rumble") + 6,
        confidence: 0.99
      });
    }

    const projectMatch = text.match(/project called\s+([A-Za-z0-9_\-\s]+?)(?=\s+on|\s+in|\s+for|\s+at|$)/i) || text.match(/project\s+([A-Za-z0-9_\-\s]+?)(?=\s+on|\s+in|\s+for|\s+at|$)/i);
    if (projectMatch && projectMatch[1] && !projectMatch[0].toLowerCase().includes("called workspace")) {
      const projName = projectMatch[1].trim();
      entities.push({
        value: projName,
        type: EntityType.PROJECT,
        startIndex: text.indexOf(projName),
        endIndex: text.indexOf(projName) + projName.length,
        confidence: 0.95
      });
    }

    return entities;
  }
}

// ─── Slot Filler Implementation ────────────────────────────────────────────────

class SlotFillerImpl implements ISlotFiller {
  constructor(private readonly engine: AssistantEngine) {}

  public async fillSlots(parsed: ParsedIntent, text: string): Promise<Slot[]> {
    const slots: Slot[] = [];

    // Fill slots based on IntentType
    if (parsed.intent.type === IntentType.CHANNEL && parsed.intent.command === CommandType.CREATE) {
      slots.push({
        name: "channelType",
        value: "youtube",
        entityType: EntityType.CHANNEL,
        required: true,
        filled: true
      });
    } else if (parsed.intent.type === IntentType.WORKSPACE && parsed.intent.command === CommandType.CREATE) {
      const projEnt = parsed.entities.find(e => e.type === EntityType.PROJECT);
      slots.push({
        name: "projectName",
        value: projEnt ? projEnt.value : "Default Project",
        entityType: EntityType.PROJECT,
        required: true,
        filled: projEnt !== undefined
      });
    } else if (parsed.intent.type === IntentType.GENERATION && parsed.intent.command === CommandType.CREATE) {
      const countMatch = text.match(/\b\d+\b/);
      slots.push({
        name: "quantity",
        value: countMatch ? countMatch[0] : "10",
        required: true,
        filled: countMatch !== null
      });
    }

    return slots;
  }
}

// ─── Command Planner Implementation ─────────────────────────────────────────────

class CommandPlannerImpl implements ICommandPlanner {
  private readonly plans: ExecutionPlan[] = [];

  constructor(private readonly engine: AssistantEngine) {}

  public async createPlan(intent: ParsedIntent): Promise<ExecutionPlan> {
    const steps: ExecutionStep[] = [];
    const intentType = intent.intent.type;

    // Map intent type to target engine steps
    if (intentType === IntentType.RESEARCH) {
      steps.push({
        id: "step-research",
        name: "Run Market Research",
        targetEngine: "ResearchEngine",
        parameters: { query: intent.rawText },
        dependsOnStepIds: [],
        status: "PENDING"
      });
    } else if (intentType === IntentType.WORKSPACE) {
      const action = intent.intent.command === CommandType.CREATE ? "createProject" : "status";
      steps.push({
        id: "step-workspace",
        name: `Workspace action: ${action}`,
        targetEngine: "WorkspaceEngine",
        parameters: { action, name: intent.slots.find(s => s.name === "projectName")?.value },
        dependsOnStepIds: [],
        status: "PENDING"
      });
    } else if (intentType === IntentType.PIPELINE) {
      steps.push({
        id: "step-pipeline",
        name: "Execute pipeline task",
        targetEngine: "PipelineEngine",
        parameters: { action: intent.intent.command.toLowerCase() },
        dependsOnStepIds: [],
        status: "PENDING"
      });
    } else {
      // Fallback/Generic step
      steps.push({
        id: "step-generic",
        name: `Invoke command ${intent.intent.command}`,
        targetEngine: "RuntimeEngine",
        parameters: { intentType, command: intent.intent.command },
        dependsOnStepIds: [],
        status: "PENDING"
      });
    }

    const plan: ExecutionPlan = {
      id: `plan-${Date.now()}`,
      intentType,
      state: PlannerState.READY,
      steps,
      costEstimate: 0.05, // Simulated cost
      durationEstimateMs: 1500, // Simulated duration
      createdAt: new Date()
    };

    AssistantValidator.validateExecutionPlan(plan);
    this.plans.push(plan);
    return plan;
  }

  public async validatePlan(plan: ExecutionPlan): Promise<void> {
    AssistantValidator.validateStepDependencies(plan.steps);
    AssistantValidator.validateExecutionPermissions(plan);
  }

  public async executePlan(plan: ExecutionPlan): Promise<ExecutionResult> {
    plan.state = PlannerState.EXECUTING;
    let completedSteps = 0;

    // Simulate/execute step execution
    for (const step of plan.steps) {
      step.status = "RUNNING";
      try {
        // Try getting engine from Runtime
        const runtime = this.engine.getContext().runtimeEngine;
        if (runtime && typeof runtime.getEngine === "function") {
          const targetEngine = runtime.getEngine(step.targetEngine);
          if (targetEngine) {
            // Engine exists! Call it or log it
            await this.engine.logToMemory("commands", `exec-${step.id}`, { target: step.targetEngine, params: step.parameters });
          }
        }
        
        // Simulate execution delay
        await new Promise(resolve => setTimeout(resolve, 5));
        step.status = "COMPLETED";
        completedSteps++;
      } catch (err: any) {
        step.status = "FAILED";
        step.error = err.message;
        plan.state = PlannerState.FAILED;
        return {
          planId: plan.id,
          success: false,
          error: err.message,
          executedStepsCount: completedSteps
        };
      }
    }

    plan.state = PlannerState.COMPLETED;
    plan.completedAt = new Date();
    return {
      planId: plan.id,
      success: true,
      executedStepsCount: completedSteps,
      outputData: { status: "Success", details: "Plan executed successfully" }
    };
  }

  public getPlannerSnapshot(): PlannerSnapshot {
    return {
      timestamp: new Date(),
      state: PlannerState.COMPLETED,
      activePlan: this.plans[this.plans.length - 1],
      recentPlans: this.plans
    };
  }
}

// ─── Conversation Manager Implementation ───────────────────────────────────────

class ConversationManagerImpl implements IConversationManager {
  private readonly histories = new Map<string, ConversationMessage[]>();

  constructor(private readonly engine: AssistantEngine) {}

  public async getHistory(sessionId: string): Promise<ConversationHistory> {
    const messages = this.histories.get(sessionId) || [];
    return { conversationId: sessionId, messages };
  }

  public async appendMessage(sessionId: string, message: ConversationMessage): Promise<void> {
    if (!this.histories.has(sessionId)) {
      this.histories.set(sessionId, []);
    }
    const history = this.histories.get(sessionId)!;
    history.push(message);
    AssistantValidator.validateConversationHistory(history);
    await this.engine.logToMemory("history", `msg-${message.id}`, message);
  }
}

// ─── Response Generator Implementation ─────────────────────────────────────────

class ResponseGeneratorImpl implements IResponseGenerator {
  constructor(private readonly engine: AssistantEngine) {}

  public async generateResponse(result: ExecutionResult, type: ResponseType, plan?: ExecutionPlan): Promise<AssistantResponse> {
    let text = "";
    if (result.success) {
      if (type === ResponseType.MARKDOWN) {
        text = `# Command Executed Successfully\n\n- **Plan ID**: \`${result.planId}\`\n- **Steps Executed**: ${result.executedStepsCount}\n- **Cost**: $0.05\n- **Status**: Completed`;
      } else if (type === ResponseType.TABLE) {
        text = `| Metric | Value |\n|---|---|\n| Plan ID | ${result.planId} |\n| Steps | ${result.executedStepsCount} |\n| Status | Completed |`;
      } else {
        text = `Command executed successfully. Steps: ${result.executedStepsCount}. Plan ID: ${result.planId}`;
      }
    } else {
      text = `Execution failed: ${result.error}`;
    }

    return {
      requestId: `req-res-${Date.now()}`,
      sessionId: "default",
      text,
      type,
      plan,
      data: result.outputData,
      timestamp: new Date()
    };
  }

  public async generateTextResponse(text: string, type: ResponseType, sessionId: string): Promise<AssistantResponse> {
    return {
      requestId: `req-text-${Date.now()}`,
      sessionId,
      text,
      type,
      timestamp: new Date()
    };
  }
}

// ─── Context Resolver Implementation ───────────────────────────────────────────

class ContextResolverImpl implements IContextResolver {
  constructor(private readonly engine: AssistantEngine) {}

  public async resolveContext(text: string, sessionId?: string): Promise<ConversationContext> {
    return {
      activeSessionId: sessionId || "default",
      variables: { commandText: text }
    };
  }
}

// ─── Session Manager Implementation ────────────────────────────────────────────

class SessionManagerImpl implements ISessionManager {
  private readonly sessions = new Map<string, AssistantSession>();

  constructor(private readonly engine: AssistantEngine) {}

  public async createSession(): Promise<AssistantSession> {
    const id = `session-${Date.now()}-${Math.floor(Math.random() * 100)}`;
    const session: AssistantSession = {
      id,
      state: ConversationState.NEW,
      context: { variables: {} },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.sessions.set(id, session);
    this.engine.emit("ConversationStarted", { sessionId: id });
    await this.engine.logToMemory("sessions", `session-${id}`, session);
    return session;
  }

  public async getSession(sessionId: string): Promise<AssistantSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SessionNotFoundException(sessionId);
    }
    return session;
  }

  public async closeSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    session.state = ConversationState.FINISHED;
    this.engine.emit("ConversationEnded", { sessionId });
  }

  public async listSessions(): Promise<AssistantSession[]> {
    return Array.from(this.sessions.values());
  }

  public async restoreSession(sessionId: string): Promise<AssistantSession> {
    const session = await this.getSession(sessionId);
    session.state = ConversationState.ACTIVE;
    this.engine.emit("SessionRestored", { sessionId });
    return session;
  }

  public async archiveSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    session.state = ConversationState.ARCHIVED;
  }

  public async deleteSession(sessionId: string): Promise<void> {
    if (!this.sessions.has(sessionId)) {
      throw new SessionNotFoundException(sessionId);
    }
    this.sessions.delete(sessionId);
  }
}

// ─── Assistant Reporter Implementation ─────────────────────────────────────────

class AssistantReporterImpl implements IAssistantReporter {
  constructor(private readonly engine: AssistantEngine) {}

  public generateReport(): AssistantReport {
    return {
      timestamp: new Date(),
      state: this.engine.getState(),
      statistics: {
        uptimeMs: this.engine.getUptimeMs(),
        commandsProcessed: this.engine.getCommandsProcessed(),
        successRate: this.engine.getCommandsProcessed() > 0 ? this.engine.getSuccessfulCommands() / this.engine.getCommandsProcessed() : 1.0,
        averageResponseTimeMs: this.engine.getAverageResponseTimeMs()
      },
      sessionsCount: 1, // simulated
      activeSessionsCount: 1 // simulated
    };
  }

  public getAssistantSnapshot(): AssistantSnapshot {
    const snap: AssistantSnapshot = {
      timestamp: new Date(),
      state: this.engine.getState(),
      report: this.generateReport()
    };
    
    // Deep freeze cloned snapshot
    const cloned = JSON.parse(JSON.stringify(snap));
    cloned.timestamp = new Date(cloned.timestamp);
    cloned.report.timestamp = new Date(cloned.report.timestamp);

    const frozen = deepFreeze(cloned);
    AssistantValidator.validateSnapshotImmutability(frozen);
    return frozen;
  }
}
