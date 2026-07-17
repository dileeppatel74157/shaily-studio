import { IAgent } from "./IAgent";
import { AgentMetadata } from "./AgentMetadata";
import { AgentState } from "./AgentState";
import { AgentContext } from "./AgentContext";
import { AgentLifecycle } from "./AgentLifecycle";
import { AgentSnapshot } from "./AgentSnapshot";
import { AgentRole } from "./AgentRole";
import { AgentCapability } from "./AgentCapability";
import { AgentGoal } from "./AgentGoal";
import { AgentProfile } from "./AgentProfile";
import { AgentConfiguration } from "./AgentConfiguration";
import { AgentExecution } from "./AgentExecution";
import { AgentValidator } from "./AgentValidator";
import { InvalidAgentStateException, deepFreeze } from "./types";
import { ISkill } from "../skills/ISkill";

export class Agent implements IAgent {
  private _state: AgentState = AgentState.CREATED;
  private readonly _skills = new Map<string, ISkill>();
  private readonly _disabledSkills = new Set<string>();

  constructor(
    private readonly _metadata: AgentMetadata,
    public readonly context: AgentContext,
    private readonly _lifecycle: AgentLifecycle
  ) {}

  public get id(): string {
    return this._metadata.id;
  }

  public get name(): string {
    return this._metadata.name;
  }

  public get role(): AgentRole {
    return this._metadata.role || "Generalist";
  }

  public get version(): string {
    return this._metadata.version;
  }

  public get description(): string {
    return this._metadata.description;
  }

  public get state(): AgentState {
    return this._state;
  }

  public get capabilities(): ReadonlyArray<AgentCapability> {
    return this._metadata.capabilities;
  }

  public get goals(): ReadonlyArray<AgentGoal> {
    return this._metadata.goals || [];
  }

  public get profile(): AgentProfile | undefined {
    return this._metadata.profile;
  }

  public get configuration(): AgentConfiguration | undefined {
    return this._metadata.configuration;
  }

  public get metadata(): Record<string, unknown> {
    return this._metadata.metadata;
  }

  public async initialize(): Promise<void> {
    try {
      AgentValidator.validateLifecycleTransition(this._state, AgentState.READY);
    } catch (err: any) {
      throw new InvalidAgentStateException(this.id, "initialize", this._state);
    }

    this.context.logger.info(`Initializing agent: ${this.name} (${this.id})`);
    try {
      await this._lifecycle.initialize(this.context);
      this._state = AgentState.READY;
      this.context.logger.info(`Agent initialized and READY: ${this.name} (${this.id})`);
    } catch (err) {
      this._state = AgentState.FAILED;
      this.context.logger.error(
        `Agent initialization failed: ${this.name} (${this.id})`,
        {},
        err instanceof Error ? err : undefined
      );
      throw err;
    }
  }

  public async start(): Promise<void> {
    AgentValidator.validateLifecycleTransition(this._state, AgentState.RUNNING);
    this._state = AgentState.RUNNING;
    this.context.logger.info(`Agent started: ${this.name} (${this.id})`);
  }

  public async pause(): Promise<void> {
    AgentValidator.validateLifecycleTransition(this._state, AgentState.PAUSED);
    this._state = AgentState.PAUSED;
    this.context.logger.info(`Agent paused: ${this.name} (${this.id})`);
  }

  public async resume(): Promise<void> {
    AgentValidator.validateLifecycleTransition(this._state, AgentState.RUNNING);
    this._state = AgentState.RUNNING;
    this.context.logger.info(`Agent resumed: ${this.name} (${this.id})`);
  }

  public async stop(): Promise<void> {
    AgentValidator.validateLifecycleTransition(this._state, AgentState.STOPPED);
    this._state = AgentState.STOPPED;
    this.context.logger.info(`Agent stopped: ${this.name} (${this.id})`);
  }

  public async execute(input?: unknown): Promise<unknown> {
    const isTask = input && typeof input === "object" && "id" in input && "description" in input;
    if (isTask) {
      AgentValidator.validateExecutionConstraints(input as any, this.configuration);
    }

    const startTime = new Date();
    try {
      AgentValidator.validateLifecycleTransition(this._state, AgentState.RUNNING);
    } catch (err: any) {
      throw new InvalidAgentStateException(this.id, "execute", this._state);
    }

    this._state = AgentState.RUNNING;

    let supervisor: any = null;
    let sessionId = "session-" + this.id + "-" + Date.now();
    if (this.context.registry) {
      try {
        const token = { name: "IExecutionSupervisor" } as any;
        if (this.context.registry.has(token)) {
          supervisor = this.context.registry.resolve(token);
        }
      } catch (e) {}
    }

    if (supervisor) {
      try {
        const policy = {
          id: "pol-agent-" + this.id,
          name: "Agent Default Policy",
          limits: {
            maxTokens: 5000,
            maxCost: 10,
            maxExecutionTimeMs: 60000,
            maxWorkflowDepth: 5,
            maxRecursion: 5,
            maxParallelJobs: 5,
            maxRetries: 3,
            maxAiCalls: 10,
            maxToolCalls: 10,
          },
          budget: {
            tokens: 5000,
            cost: 10,
            executionTimeMs: 60000,
            apiCalls: 10,
            providerUsage: {},
          },
          allowedRecoveries: ["retry", "rollback"],
        };

        const session = new (require("../supervisor/ExecutionBuilder").ExecutionBuilder)()
          .withId(sessionId)
          .withType("agent")
          .withPolicy(policy as any)
          .withContext(this.context as any)
          .build();

        await supervisor.registerSession(session);
        await supervisor.updateSessionState(sessionId, "RUNNING" as any);
        await supervisor.consumeBudget(sessionId, 10, 0.05);
      } catch (e) {}
    }
    
    // Agents request plans before execution
    if (this.context.registry) {
      try {
        const token = { name: "IPlanningEngine" } as any;
        if (this.context.registry.has(token)) {
          const planningEngine = this.context.registry.resolve(token) as any;
          if (planningEngine) {
            await planningEngine.createPlan({
              id: "plan-exec-" + this.id + "-" + Date.now(),
              goal: {
                id: "goal-exec-" + this.id + "-" + Date.now(),
                description: this.description || "Execute agent task",
                priority: "NORMAL" as any,
                type: "SIMPLE" as any,
                status: "PENDING" as any,
              },
            });
          }
        }
      } catch (e) {
        // Ignored to avoid breaking tests where PlanningEngine is not bound
      }
    }

    this.context.logger.info(`Executing agent task: ${this.name} (${this.id})`);

    if (this.context.eventBus) {
      await this.context.eventBus.publish({
        id: "evt-" + Math.random().toString(36).substring(2, 11),
        name: "AgentStarted",
        timestamp: new Date(),
        correlationId: "corr-agent",
        source: "Agent:" + this.id,
        payload: { agentId: this.id, input },
        metadata: {},
      });
    }
    try {
      let result;
      if (
        this.capabilities.includes("research" as any) &&
        this.context.researchEngine &&
        input &&
        typeof input === "object" &&
        "channelProfile" in input &&
        "type" in input
      ) {
        result = await this.context.researchEngine.execute(input as any);
      } else if (
        this.capabilities.includes("strategy" as any) &&
        this.context.strategyEngine &&
        input &&
        typeof input === "object" &&
        "researchResponse" in input &&
        "type" in input
      ) {
        result = await this.context.strategyEngine.generate(input as any);
      } else {
        result = await this._lifecycle.execute(this.context, input);
      }
      
      try {
        AgentValidator.validateLifecycleTransition(this._state, AgentState.COMPLETED);
      } catch (err: any) {
        throw new InvalidAgentStateException(this.id, "complete", this._state);
      }
      this._state = AgentState.COMPLETED;
      this.context.logger.info(`Agent execution COMPLETED: ${this.name} (${this.id})`);

      if (this.context.eventBus) {
        await this.context.eventBus.publish({
          id: "evt-" + Math.random().toString(36).substring(2, 11),
          name: "AgentFinished",
          timestamp: new Date(),
          correlationId: "corr-agent",
          source: "Agent:" + this.id,
          payload: { agentId: this.id, success: true },
          metadata: {},
        });
      }

      const execution: AgentExecution = deepFreeze({
        id: "exec-" + Math.random().toString(36).substring(2, 11),
        agentId: this.id,
        taskId: isTask ? (input as any).id : undefined,
        status: this._state,
        input,
        output: result,
        startTime,
        endTime: new Date(),
      });

      if (supervisor) {
        try {
          await supervisor.updateSessionState(sessionId, "COMPLETED" as any);
        } catch (e) {}
      }

      if (isTask) {
        return execution;
      }
      return result;
    } catch (err: any) {
      if (supervisor) {
        try {
          await supervisor.recordFailure(sessionId, err);
          await supervisor.executeRecovery(sessionId);
        } catch (e) {}
      }
      try {
        AgentValidator.validateLifecycleTransition(this._state, AgentState.FAILED);
      } catch (e: any) {
        // do not override original error if transition validation fails
      }
      this._state = AgentState.FAILED;
      this.context.logger.error(
        `Agent execution FAILED: ${this.name} (${this.id})`,
        {},
        err instanceof Error ? err : undefined
      );

      if (this.context.eventBus) {
        await this.context.eventBus.publish({
          id: "evt-" + Math.random().toString(36).substring(2, 11),
          name: "AgentFinished",
          timestamp: new Date(),
          correlationId: "corr-agent",
          source: "Agent:" + this.id,
          payload: { agentId: this.id, success: false, error: err.message },
          metadata: {},
        });
      }

      deepFreeze({
        id: "exec-" + Math.random().toString(36).substring(2, 11),
        agentId: this.id,
        taskId: isTask ? (input as any).id : undefined,
        status: this._state,
        input,
        error: err.message,
        startTime,
        endTime: new Date(),
      });

      throw err;
    }
  }

  public async selectExecutionOption<T extends { id: string; name: string }>(
    type: any,
    options: T[],
    criteria?: any[]
  ): Promise<T> {
    if (options.length === 0) {
      throw new Error("No options provided to selectExecutionOption");
    }
    if (this.context.registry) {
      const token = { name: "IDecisionEngine" } as any;
      if (this.context.registry.has(token)) {
        const decisionEngine = this.context.registry.resolve(token) as any;
        if (decisionEngine) {
          const builder = new (require("../decision/DecisionBuilder").DecisionBuilder)()
            .withId("dec-agent-" + this.id + "-" + Date.now())
            .withType(type)
            .withPriority("NORMAL" as any)
            .withContext(this.context as any);

          for (const opt of options) {
            builder.addOption({
              id: opt.id,
              name: opt.name,
              description: (opt as any).description || opt.name,
              cost: (opt as any).cost || 1.0,
              reward: (opt as any).reward || 2.0,
              risk: (opt as any).risk || "LOW",
              metadata: (opt as any).metadata || {},
            });
          }

          if (criteria && criteria.length > 0) {
            for (const c of criteria) {
              builder.addCriteria(c);
            }
          } else {
            builder.addCriteria({ name: "alignment", weight: 0.5 });
            builder.addCriteria({ name: "feasibility", weight: 0.5 });
          }

          const dec = builder.build();
          const evaluated = await decisionEngine.evaluate(dec);
          const chosen = options.find((o) => o.id === evaluated.selectedOptionId);
          if (chosen) return chosen;
        }
      }
    }
    return options[0];
  }

  public async shutdown(): Promise<void> {
    this.context.logger.info(`Shutting down agent: ${this.name} (${this.id})`);
    try {
      await this._lifecycle.shutdown(this.context);
      this._state = AgentState.STOPPED;
      this.context.logger.info(`Agent shutdown STOPPED: ${this.name} (${this.id})`);
    } catch (err) {
      this._state = AgentState.FAILED;
      this.context.logger.error(
        `Agent shutdown failed: ${this.name} (${this.id})`,
        {},
        err instanceof Error ? err : undefined
      );
      throw err;
    }
  }

  // Agent Collaboration Methods
  private getCollaborationEngine(): any {
    if (this.context.registry) {
      const token = { name: "IAgentCommunication" } as any;
      if (this.context.registry.has(token)) {
        return this.context.registry.resolve(token);
      }
    }
    throw new Error("IAgentCommunication is not registered in the service registry.");
  }

  public async sendMessage(recipientId: string, content: string, type: any = "TASK"): Promise<any> {
    const engine = this.getCollaborationEngine();
    return engine.send({
      type,
      priority: "NORMAL",
      senderId: this.id,
      recipientId,
      conversationId: "conv-" + this.id + "-" + recipientId,
      content,
      metadata: {},
    });
  }

  public async broadcast(content: string, recipientIds: ReadonlyArray<string>): Promise<void> {
    const engine = this.getCollaborationEngine();
    await engine.broadcast(
      {
        type: "NOTIFICATION",
        priority: "NORMAL",
        senderId: this.id,
        content,
        metadata: {},
      },
      recipientIds
    );
  }

  public async delegateTask(delegateeId: string, taskTitle: string, taskDescription: string): Promise<any> {
    const engine = this.getCollaborationEngine();
    return engine.delegate({
      title: taskTitle,
      description: taskDescription,
      assigneeId: delegateeId,
      assignerId: this.id,
      metadata: {},
    });
  }

  public async reply(messageId: string, content: string): Promise<any> {
    const engine = this.getCollaborationEngine();
    return engine.reply(messageId, content);
  }

  public async receive(): Promise<ReadonlyArray<any>> {
    const engine = this.getCollaborationEngine();
    return engine.receive(this.id);
  }

  public async heartbeat(): Promise<void> {
    const engine = this.getCollaborationEngine();
    await engine.heartbeat(this.id);
  }

  public async presence(status: any): Promise<void> {
    const engine = this.getCollaborationEngine();
    await engine.presence(this.id, status);
  }

  public async conversationHistory(conversationId: string): Promise<any> {
    const engine = this.getCollaborationEngine();
    return engine.conversationHistory(conversationId);
  }

  public async installSkill(skill: ISkill): Promise<void> {
    this._skills.set(skill.id, skill);
    if (skill.state === "CREATED") {
      await skill.initialize();
    }
  }

  public async removeSkill(skillId: string): Promise<void> {
    const skill = this._skills.get(skillId);
    if (skill) {
      await skill.stop();
      this._skills.delete(skillId);
      this._disabledSkills.delete(skillId);
    }
  }

  public async enableSkill(skillId: string): Promise<void> {
    if (!this._skills.has(skillId)) {
      throw new Error(`Skill ${skillId} is not installed on agent ${this.id}`);
    }
    this._disabledSkills.delete(skillId);
  }

  public async disableSkill(skillId: string): Promise<void> {
    if (!this._skills.has(skillId)) {
      throw new Error(`Skill ${skillId} is not installed on agent ${this.id}`);
    }
    this._disabledSkills.add(skillId);
  }

  public async executeSkill(skillId: string, input?: unknown): Promise<unknown> {
    const skill = this._skills.get(skillId);
    if (!skill) {
      throw new Error(`Skill ${skillId} is not installed on agent ${this.id}`);
    }
    if (this._disabledSkills.has(skillId)) {
      throw new Error(`Skill ${skillId} is disabled on agent ${this.id}`);
    }
    const result = await skill.execute(input);
    if (!result.success) {
      throw new Error(result.error || `Failed to execute skill ${skillId}`);
    }
    return result.output;
  }

  public listSkills(): ReadonlyArray<ISkill> {
    return Array.from(this._skills.values());
  }

  public snapshot(): AgentSnapshot {
    return deepFreeze({
      id: this.id,
      name: this.name,
      role: this.role,
      version: this.version,
      description: this.description,
      state: this._state,
      capabilities: [...this.capabilities],
      goals: [...this.goals],
      profile: this.profile ? { ...this.profile } : undefined,
      configuration: this.configuration ? { ...this.configuration } : undefined,
      metadata: JSON.parse(JSON.stringify(this.metadata)),
      timestamp: new Date(),
    });
  }
}
