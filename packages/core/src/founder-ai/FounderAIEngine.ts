import { FounderAIState } from "./FounderAIState";
import { FounderMode } from "./FounderMode";
import { FounderGoalType } from "./FounderGoalType";
import { DecisionPriority } from "./DecisionPriority";
import { ExecutionMode } from "./ExecutionMode";
import { RecommendationState } from "./RecommendationState";
import { FounderEventType } from "./FounderEventType";
import {
  IFounderAIEngine,
  IFounderManager,
  IGoalManager,
  IDecisionManager,
  IPlanningManager,
  IExecutionManager,
  IRecommendationManager,
  IInsightManager,
  IRoutineManager,
  IHistoryManager,
  IStatisticsManager
} from "./interfaces";
import {
  FounderProfile,
  FounderGoal,
  FounderDecision,
  FounderTask,
  FounderSession,
  FounderDailyBrief,
  FounderInsight,
  FounderRecommendation,
  FounderExecutionPlan,
  FounderSnapshot,
  FounderStatistics
} from "./models";
import {
  FounderAIException,
  GoalException,
  DecisionException,
  PlanningException,
  ExecutionException,
  deepFreeze
} from "./exceptions";
import { FounderAIValidator } from "./FounderAIValidator";

export class FounderAIEngine implements IFounderAIEngine {
  private _state = FounderAIState.CREATED;
  private readonly _eventHandlers = new Map<string, Set<(payload: any) => void>>();
  
  // Internal registries
  private _profile: FounderProfile = {
    id: "founder_1",
    name: "Founder",
    preferences: { theme: "dark", enableNotifications: true, alertOnRiskPercent: 20 },
    workingHours: "09:00-17:00",
    preferredProviders: ["Ollama", "Gemini"],
    businessGoals: ["Grow YouTube Audience", "Automate Video Scripting"],
    activeProjects: ["Shaily OS Integration"]
  };
  
  private readonly _goals = new Map<string, FounderGoal>();
  private readonly _decisions = new Map<string, FounderDecision>();
  private readonly _sessions = new Map<string, FounderSession>();
  private readonly _history: FounderSnapshot[] = [];
  private readonly _recommendations: FounderRecommendation[] = [];
  
  private _stats: FounderStatistics = {
    tasksCompleted: 45,
    goalsCompleted: 8,
    projectsActive: 2,
    hoursSaved: 120,
    tokensUsed: 45000,
    moneySpent: 8.5,
    videosCreated: 15,
    postsPublished: 12,
    analyticsReportsRun: 5,
    optimizationRuns: 4
  };

  private readonly _founderMgr: IFounderManager;
  private readonly _goalMgr: IGoalManager;
  private readonly _decisionMgr: IDecisionManager;
  private readonly _planningMgr: IPlanningManager;
  private readonly _executionMgr: IExecutionManager;
  private readonly _recommendationMgr: IRecommendationManager;
  private readonly _insightMgr: IInsightManager;
  private readonly _routineMgr: IRoutineManager;
  private readonly _historyMgr: IHistoryManager;
  private readonly _statsMgr: IStatisticsManager;
  private readonly _validator = new FounderAIValidator();

  constructor(public readonly context: any) {
    if (!context) {
      throw new FounderAIException("Context is required to build FounderAIEngine.");
    }
    
    this._founderMgr = new FounderManagerImpl(this);
    this._goalMgr = new GoalManagerImpl(this);
    this._decisionMgr = new DecisionManagerImpl(this);
    this._planningMgr = new PlanningManagerImpl(this);
    this._executionMgr = new ExecutionManagerImpl(this);
    this._recommendationMgr = new RecommendationManagerImpl(this);
    this._insightMgr = new InsightManagerImpl(this);
    this._routineMgr = new RoutineManagerImpl(this);
    this._historyMgr = new HistoryManagerImpl(this);
    this._statsMgr = new StatisticsManagerImpl(this);
  }

  // --- IFounderAIEngine Lifecycle ---

  public async initialize(): Promise<void> {
    if (this._state !== FounderAIState.CREATED && this._state !== FounderAIState.STOPPED) {
      throw new FounderAIException(`Cannot initialize FounderAIEngine in state: ${this._state}`);
    }
    
    this._state = FounderAIState.INITIALIZING;
    try {
      this._goals.clear();
      this._decisions.clear();
      this._sessions.clear();
      this._recommendations.length = 0;
      
      // Register some default founder goals
      this._goalMgr.createGoal({
        id: "goal_grow_views",
        title: "Grow Monthly Channel Views to 100k",
        type: FounderGoalType.Growth,
        priority: 8,
        progressPercent: 65,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: "active"
      });

      this._goalMgr.createGoal({
        id: "goal_automate_publishing",
        title: "Automate All Social Media Posts",
        type: FounderGoalType.Productivity,
        priority: 9,
        progressPercent: 90,
        deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        status: "active"
      });
      
      this._state = FounderAIState.READY;
    } catch (err: any) {
      this._state = FounderAIState.FAILED;
      throw new FounderAIException(`Initialization failed: ${err.message}`);
    }
  }

  public async start(): Promise<void> {
    if (this._state !== FounderAIState.READY && this._state !== FounderAIState.STOPPED) {
      throw new FounderAIException(`Cannot start FounderAIEngine in state: ${this._state}`);
    }
    this._state = FounderAIState.RUNNING;
  }

  public async stop(): Promise<void> {
    if (this._state !== FounderAIState.RUNNING) {
      throw new FounderAIException(`Cannot stop FounderAIEngine in state: ${this._state}`);
    }
    this._state = FounderAIState.STOPPED;
  }

  public getState(): FounderAIState {
    return this._state;
  }

  public getSnapshot(): FounderSnapshot {
    const snapshot: FounderSnapshot = {
      timestamp: new Date(),
      state: this._state,
      profile: {
        ...this._profile,
        preferences: { ...this._profile.preferences },
        preferredProviders: [...this._profile.preferredProviders],
        businessGoals: [...this._profile.businessGoals],
        activeProjects: [...this._profile.activeProjects]
      },
      goals: Array.from(this._goals.values()).map(g => ({ ...g })),
      decisions: Array.from(this._decisions.values()).map(d => ({ ...d })),
      insights: [this._insightMgr.generateInsights()],
      statistics: this._statsMgr.getStats()
    };

    this._validator.validateSnapshot(snapshot);
    return deepFreeze(snapshot);
  }

  public getStatistics(): FounderStatistics {
    return this._statsMgr.getStats();
  }

  // --- Sub-Managers Getters ---

  public getFounderManager(): IFounderManager { return this._founderMgr; }
  public getGoalManager(): IGoalManager { return this._goalMgr; }
  public getDecisionManager(): IDecisionManager { return this._decisionMgr; }
  public getPlanningManager(): IPlanningManager { return this._planningMgr; }
  public getExecutionManager(): IExecutionManager { return this._executionMgr; }
  public getRecommendationManager(): IRecommendationManager { return this._recommendationMgr; }
  public getInsightManager(): IInsightManager { return this._insightMgr; }
  public getRoutineManager(): IRoutineManager { return this._routineMgr; }
  public getHistoryManager(): IHistoryManager { return this._historyMgr; }
  public getStatisticsManager(): IStatisticsManager { return this._statsMgr; }

  // --- Event Handling ---

  public on(event: string, handler: (payload: any) => void): void {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event)!.add(handler);
  }

  public off(event: string, handler: (payload: any) => void): void {
    this._eventHandlers.get(event)?.delete(handler);
  }

  public emit(event: string, payload?: any): void {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      for (const h of handlers) {
        try {
          h(payload);
        } catch {
          // ignore
        }
      }
    }
  }

  // --- Helper Methods ---

  public getEngine<T>(id: string): T | undefined {
    if (this.context[id.charAt(0).toLowerCase() + id.slice(1)]) {
      return this.context[id.charAt(0).toLowerCase() + id.slice(1)] as T;
    }
    if (this.context.runtimeEngine) {
      try {
        return this.context.runtimeEngine.getEngine(id) as T;
      } catch {}
    }
    return undefined;
  }

  // Internal accessors
  public get profile() { return this._profile; }
  public set profile(v) { this._profile = v; }
  public get goals() { return this._goals; }
  public get decisions() { return this._decisions; }
  public get sessions() { return this._sessions; }
  public get history() { return this._history; }
  public get recommendations() { return this._recommendations; }
  public get stats() { return this._stats; }
  public get validator() { return this._validator; }
}

// --- Founder Manager Implementation ---

class FounderManagerImpl implements IFounderManager {
  constructor(private readonly engine: FounderAIEngine) {}

  public getProfile(): FounderProfile {
    return this.engine.profile;
  }

  public updateProfile(profile: Partial<FounderProfile>): void {
    this.engine.profile = {
      ...this.engine.profile,
      ...profile,
      preferences: profile.preferences ? { ...this.engine.profile.preferences, ...profile.preferences } : this.engine.profile.preferences
    };
    this.engine.validator.validateProfile(this.engine.profile);
  }
}

// --- Goal Manager Implementation ---

class GoalManagerImpl implements IGoalManager {
  constructor(private readonly engine: FounderAIEngine) {}

  public createGoal(goal: FounderGoal): void {
    this.engine.validator.validateGoal(goal);
    if (this.engine.goals.has(goal.id)) {
      throw new GoalException(`Goal ID ${goal.id} already exists.`);
    }
    this.engine.goals.set(goal.id, goal);
  }

  public updateGoal(id: string, updates: Partial<FounderGoal>): void {
    const goal = this.engine.goals.get(id);
    if (!goal) {
      throw new GoalException(`Goal ${id} not found.`);
    }
    const updatedGoal = { ...goal, ...updates };
    this.engine.validator.validateGoal(updatedGoal);
    this.engine.goals.set(id, updatedGoal);
  }

  public archiveGoal(id: string): void {
    const goal = this.engine.goals.get(id);
    if (!goal) {
      throw new GoalException(`Goal ${id} not found.`);
    }
    goal.status = "archived";
  }

  public listGoals(): FounderGoal[] {
    return Array.from(this.engine.goals.values());
  }
}

// --- Decision Manager Implementation ---

class DecisionManagerImpl implements IDecisionManager {
  constructor(private readonly engine: FounderAIEngine) {}

  public evaluateDecision(decision: FounderDecision): FounderDecision {
    if (decision.alternatives.length === 0) {
      throw new DecisionException("At least one alternative option is required.");
    }
    
    // Evaluate and select highest scoring option
    let bestOption = decision.alternatives[0];
    let maxScore = decision.scores[bestOption] || 50;
    
    for (const opt of decision.alternatives) {
      const score = decision.scores[opt] || 50;
      if (score > maxScore) {
        maxScore = score;
        bestOption = opt;
      }
    }
    
    decision.chosenOption = bestOption;
    decision.reason = `Selected "${bestOption}" because it obtained the highest evaluation score of ${maxScore}/100.`;
    
    this.engine.validator.validateDecision(decision);
    this.engine.decisions.set(decision.id, decision);
    this.engine.emit(FounderEventType.DECISION_MADE, { decision });
    return decision;
  }

  public getDecision(id: string): FounderDecision | undefined {
    return this.engine.decisions.get(id);
  }

  public listDecisions(): FounderDecision[] {
    return Array.from(this.engine.decisions.values());
  }
}

// --- Planning Manager Implementation ---

class PlanningManagerImpl implements IPlanningManager {
  constructor(private readonly engine: FounderAIEngine) {}

  public async generateDailyPlan(): Promise<FounderDailyBrief> {
    const brief = {
      briefDate: new Date(),
      priorities: ["Grow YouTube Audience", "Automate Video Scripting"],
      blockedTasksCount: 0,
      upcomingDeadlinesCount: 2,
      healthScore: 98
    };
    this.engine.validator.validateDailyBrief(brief);
    this.engine.emit(FounderEventType.DAILY_BRIEF_GENERATED, { brief });
    return brief;
  }

  public async generateWeeklyPlan(): Promise<string[]> {
    return ["Run Content Generation", "Publish YouTube Video", "Verify Channel Analytics"];
  }
}

// --- Execution Manager Implementation ---

class ExecutionManagerImpl implements IExecutionManager {
  constructor(private readonly engine: FounderAIEngine) {}

  public async executeCommand(command: string): Promise<any> {
    this.engine.emit(FounderEventType.COMMAND_RECEIVED, { command });
    
    let result: any = { status: "simulated", command };
    
    // Command Center routing
    if (command === "Start today's work" || command === "Optimize pipeline") {
      const dailyAutomation = this.engine.getEngine<any>("DailyAutomationEngine");
      if (dailyAutomation && dailyAutomation.getRoutineManager) {
        try {
          const run = await dailyAutomation.getRoutineManager().executeRoutine("routine_morning", AutomationTrigger.Founder);
          result = { status: "success", executed: "DailyAutomationEngine morning startup", runId: run.id };
        } catch (err: any) {
          result = { status: "failure", error: err.message };
        }
      }
    } else if (command === "Generate today's video") {
      const pipeline = this.engine.getEngine<any>("ContentPipelineEngine");
      if (pipeline && pipeline.getVideoGenerationManager) {
        try {
          const videos = await pipeline.getVideoGenerationManager().generateVideos([]);
          result = { status: "success", videosGenerated: videos.length };
        } catch {}
      }
    } else if (command === "Publish today's content") {
      const yt = this.engine.getEngine<any>("YouTubeIntegrationEngine");
      if (yt && yt.uploadVideo) {
        try {
          const ytRes = await yt.uploadVideo("video_render_draft.mp4", {});
          result = { status: "success", published: "YouTube", videoId: ytRes.videoId };
        } catch {}
      }
    } else if (command === "Emergency stop" || command === "Shutdown AI OS") {
      // Safe shutdown simulation
      result = { status: "success", shutdownCode: 0, time: new Date() };
    }
    
    this.engine.emit(FounderEventType.COMMAND_COMPLETED, { command, result });
    return result;
  }
}

// --- Recommendation Manager Implementation ---

class RecommendationManagerImpl implements IRecommendationManager {
  constructor(private readonly engine: FounderAIEngine) {}

  public generateRecommendations(): FounderRecommendation[] {
    const recs = [
      {
        id: `rec_${Date.now()}_1`,
        title: "Optimize Video Intro Hook",
        suggestion: "Use an engaging visual dynamic pattern in the first 3 seconds.",
        confidence: 88,
        state: RecommendationState.ACTIVE,
        timestamp: new Date()
      },
      {
        id: `rec_${Date.now()}_2`,
        title: "Enable Ollama Cache",
        suggestion: "Reduces local inference latency metrics significantly.",
        confidence: 94,
        state: RecommendationState.ACTIVE,
        timestamp: new Date()
      }
    ];

    recs.forEach(r => {
      this.engine.validator.validateRecommendation(r);
      this.engine.recommendations.push(r);
      this.engine.emit(FounderEventType.RECOMMENDATION_ACTIVE, { recommendation: r });
    });

    return [...this.engine.recommendations];
  }

  public listRecommendations(): FounderRecommendation[] {
    return [...this.engine.recommendations];
  }
}

// --- Insight Manager Implementation ---

class InsightManagerImpl implements IInsightManager {
  constructor(private readonly engine: FounderAIEngine) {}

  public generateInsights(): FounderInsight {
    return {
      id: "insight_niche_1",
      niche: "AI Video Automation",
      bestPostingTime: "18:00 UTC",
      hooksPerformance: { "Questions Hook": 94, "Contrarian Hook": 82 },
      budgetSaved: 42.5,
      productivityScore: 96
    };
  }

  public getInsights(): FounderInsight | undefined {
    return this.generateInsights();
  }
}

// --- Routine Manager Implementation ---

class RoutineManagerImpl implements IRoutineManager {
  constructor(private readonly engine: FounderAIEngine) {}

  public startSession(mode: FounderMode): FounderSession {
    const session: FounderSession = {
      id: `sess_${Date.now()}`,
      mode,
      startedAt: new Date()
    };
    this.engine.validator.validateSession(session);
    this.engine.sessions.set(session.id, session);
    return session;
  }

  public endSession(sessionId: string): void {
    const sess = this.engine.sessions.get(sessionId);
    if (sess) {
      sess.completedAt = new Date();
    }
  }
}

// --- History Manager Implementation ---

class HistoryManagerImpl implements IHistoryManager {
  constructor(private readonly engine: FounderAIEngine) {}

  public saveSnapshot(snapshot: FounderSnapshot): void {
    this.engine.validator.validateSnapshot(snapshot);
    this.engine.history.push(snapshot);
    if (this.engine.history.length > 50) {
      this.engine.history.shift();
    }
  }

  public getHistory(): FounderSnapshot[] {
    return [...this.engine.history];
  }
}

// --- Statistics Manager Implementation ---

class StatisticsManagerImpl implements IStatisticsManager {
  constructor(private readonly engine: FounderAIEngine) {}

  public getStats(): FounderStatistics {
    return { ...this.engine.stats };
  }

  public recordTaskCompleted(): void {
    this.engine.stats.tasksCompleted++;
  }

  public recordGoalCompleted(): void {
    this.engine.stats.goalsCompleted++;
  }

  public recordHoursSaved(hours: number): void {
    if (hours < 0) {
      throw new FounderAIException("Hours saved cannot be negative.");
    }
    this.engine.stats.hoursSaved += hours;
  }
}
