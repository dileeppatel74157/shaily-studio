import { LearningState }              from "./LearningState";
import { LearningSource }             from "./LearningSource";
import { LearningType }               from "./LearningType";
import { PatternConfidence }          from "./PatternConfidence";
import { RecommendationPriority }     from "./RecommendationPriority";
import { KnowledgeType }              from "./KnowledgeType";
import { ImprovementTarget }          from "./ImprovementTarget";
import { deepFreeze }                 from "./types";
import { LearningValidator }          from "./LearningValidator";
import type {
  ILearningEngine,
  IPatternAnalyzer,
  ISuccessAnalyzer,
  IFailureAnalyzer,
  IRecommendationEngine,
  IKnowledgeManager,
  IWorkflowLearner,
  IPromptLearner,
  IDecisionLearner,
  IProviderLearner,
} from "./interfaces";
import type {
  LearningRequest,
  LearningResponse,
  LearningSession,
  LearningPattern,
  SuccessPattern,
  FailurePattern,
  WorkflowPattern,
  PromptPattern,
  DecisionPattern,
  ProviderPattern,
  QualityPattern,
  KnowledgeEntry,
  KnowledgeGraph,
  Recommendation,
  LearningInsight,
  ImprovementPlan,
  LearningMetrics,
  LearningStatistics,
  LearningReport,
  LearningSnapshot,
  PatternCluster,
  TrainingDataset,
  LearningHistory,
  LearningMemory,
} from "./models";

// ─── Default Sub-Learner Implementations ──────────────────────────────────────

class DefaultPatternAnalyzer implements IPatternAnalyzer {
  public analyze(history: LearningHistory[]): LearningPattern[] {
    const list: LearningPattern[] = [];
    if (history.length >= 2) {
      list.push({
        id: "patt-general-01",
        type: LearningType.PERFORMANCE_PATTERN,
        name: "High Viewer Retention Pattern",
        description: "Higher retention observed when video length is under 5 minutes",
        confidence: PatternConfidence.HIGH,
        supportCount: history.length,
        lastObservedAt: new Date(),
        features: { optimalLengthSec: 300 },
      });
    }
    return list;
  }
}

class DefaultSuccessAnalyzer implements ISuccessAnalyzer {
  public analyzeSuccess(history: LearningHistory[]): SuccessPattern[] {
    return history.filter(h => h.success).map((h, i) => ({
      id: `patt-succ-${h.id}`,
      type: LearningType.SUCCESS_PATTERN,
      name: `Successful project ${h.projectId}`,
      description: `Execution succeeded with overall high metrics`,
      confidence: PatternConfidence.HIGH,
      supportCount: 1,
      lastObservedAt: new Date(),
      features: { metrics: h.metrics },
      overallScore: h.metrics.overallScore ?? 85,
      ctrPercent: h.metrics.ctrPercent ?? 6.2,
      retentionPercent: h.metrics.retentionPercent ?? 55,
    }));
  }
}

class DefaultFailureAnalyzer implements IFailureAnalyzer {
  public analyzeFailure(history: LearningHistory[]): FailurePattern[] {
    return history.filter(h => !h.success).map((h, i) => ({
      id: `patt-fail-${h.id}`,
      type: LearningType.FAILURE_PATTERN,
      name: `Execution Failure ${h.projectId}`,
      description: `Failed during execution with error logs`,
      confidence: PatternConfidence.HIGH,
      supportCount: 1,
      lastObservedAt: new Date(),
      features: {},
      failureReason: "Quality check failed or timeout",
      stageName: "quality",
    }));
  }
}

class DefaultRecommendationEngine implements IRecommendationEngine {
  public generateRecommendations(patterns: LearningPattern[]): Recommendation[] {
    const recs: Recommendation[] = [];
    for (const p of patterns) {
      if (p.type === LearningType.SUCCESS_PATTERN) {
        recs.push({
          id: `rec-succ-${p.id}`,
          priority: RecommendationPriority.HIGH,
          target: ImprovementTarget.SCRIPT,
          title: "Optimize script template based on hook pattern",
          description: "Apply successful structure elements detected in top-performing executions.",
          expectedImpactPercent: 18,
          actionCode: "APPLY_HOOK_TEMPLATE",
          parameters: { patternId: p.id },
          createdAt: new Date(),
          applied: false,
        });
      } else if (p.type === LearningType.FAILURE_PATTERN) {
        recs.push({
          id: `rec-fail-${p.id}`,
          priority: RecommendationPriority.CRITICAL,
          target: ImprovementTarget.QUALITY,
          title: "Strengthen pre-render quality checks",
          description: "Prevent render stage timeouts by validating assets beforehand.",
          expectedImpactPercent: 25,
          actionCode: "ENFORCE_PRERENDER_CHECK",
          parameters: { patternId: p.id },
          createdAt: new Date(),
          applied: false,
        });
      }
    }

    // Default recommendation if list is empty
    if (recs.length === 0) {
      recs.push({
        id: `rec-default-${Date.now()}`,
        priority: RecommendationPriority.NORMAL,
        target: ImprovementTarget.GLOBAL,
        title: "Regular optimization iteration",
        description: "Maintain current pipeline benchmarks.",
        expectedImpactPercent: 5,
        actionCode: "MAINTAIN_BENCHMARKS",
        parameters: {},
        createdAt: new Date(),
        applied: false,
      });
    }

    return recs;
  }
}

class DefaultKnowledgeManager implements IKnowledgeManager {
  private _entries = new Map<string, KnowledgeEntry>();

  constructor() {
    // Seed initial rules and practices
    const initial: KnowledgeEntry[] = [
      { id: "kn-01", type: KnowledgeType.RULE, target: ImprovementTarget.PUBLISHING, title: "Optimize upload time", description: "Schedule posts around peak subscriber engagement hours", confidence: PatternConfidence.HIGH, updatedAt: new Date(), dependencies: [] },
      { id: "kn-02", type: KnowledgeType.BEST_PRACTICE, target: ImprovementTarget.SCRIPT, title: "Engaging hook structure", description: "Capture attention in the first 3 seconds using pattern interrupts", confidence: PatternConfidence.VERY_HIGH, updatedAt: new Date(), dependencies: [] },
    ];
    for (const e of initial) {
      this._entries.set(e.id, e);
    }
  }

  updateKnowledge(entries: KnowledgeEntry[]): void {
    const list = [...this._entries.values(), ...entries];
    LearningValidator.validateNoCircularKnowledgeReferences(list);
    LearningValidator.validateNoDuplicateKnowledgeEntries(list);

    for (const e of entries) {
      this._entries.set(e.id, e);
    }
  }

  getGraph(): KnowledgeGraph {
    const entries = [...this._entries.values()];
    const relations: Array<{ fromId: string; toId: string; relationType: string }> = [];
    for (const e of entries) {
      for (const dep of e.dependencies) {
        relations.push({ fromId: e.id, toId: dep, relationType: "DEPENDS_ON" });
      }
    }
    return {
      entries,
      relations,
      version: 1,
      lastUpdated: new Date(),
    };
  }

  getEntry(id: string): KnowledgeEntry | undefined {
    return this._entries.get(id);
  }

  listEntries(): KnowledgeEntry[] {
    return [...this._entries.values()];
  }
}

class DefaultWorkflowLearner implements IWorkflowLearner {
  public learnWorkflow(history: LearningHistory[]): WorkflowPattern[] {
    const list: WorkflowPattern[] = [];
    if (history.length > 0) {
      list.push({
        id: "wf-patt-01",
        type: LearningType.WORKFLOW_PATTERN,
        name: "Standard Production Flow",
        description: "Optimal engine execution pipeline observed",
        confidence: PatternConfidence.HIGH,
        supportCount: history.length,
        lastObservedAt: new Date(),
        features: {},
        sequence: ["research", "strategy", "script", "generation", "composition", "rendering"],
        avgDurationMs: history.reduce((sum, h) => sum + h.durationMs, 0) / history.length,
      });
    }
    return list;
  }
}

class DefaultPromptLearner implements IPromptLearner {
  public learnPrompt(history: LearningHistory[]): PromptPattern[] {
    const list: PromptPattern[] = [];
    if (history.length > 0) {
      list.push({
        id: "prompt-patt-01",
        type: LearningType.PROMPT_PATTERN,
        name: "Adjective-heavy Generation Prompt",
        description: "Bolder creative prompts yield higher quality composition outcomes",
        confidence: PatternConfidence.MEDIUM,
        supportCount: history.length,
        lastObservedAt: new Date(),
        features: {},
        systemPromptHash: "hash-001",
        improvementSuggestion: "Use concise, high-contrast visual descriptor tokens",
      });
    }
    return list;
  }
}

class DefaultDecisionLearner implements IDecisionLearner {
  public learnDecision(history: LearningHistory[]): DecisionPattern[] {
    const list: DecisionPattern[] = [];
    if (history.length > 0) {
      list.push({
        id: "dec-patt-01",
        type: LearningType.DECISION_PATTERN,
        name: "Quality Threshold Routing",
        description: "Increasing quality score floor prevents post-publish user dropoffs",
        confidence: PatternConfidence.HIGH,
        supportCount: history.length,
        lastObservedAt: new Date(),
        features: {},
        choiceMade: "ENFORCE_MIN_QUALITY_80",
        outcomeMetric: "RETENTION_RATE",
      });
    }
    return list;
  }
}

class DefaultProviderLearner implements IProviderLearner {
  public learnProvider(history: LearningHistory[]): ProviderPattern[] {
    const list: ProviderPattern[] = [];
    if (history.length > 0) {
      list.push({
        id: "prov-patt-01",
        type: LearningType.PROVIDER_PATTERN,
        name: "OpenAI Token Cost Efficiency",
        description: "OpenAI GPT-4o performs with optimal speed-to-cost ratio",
        confidence: PatternConfidence.VERY_HIGH,
        supportCount: history.length,
        lastObservedAt: new Date(),
        features: {},
        providerName: "OpenAI",
        latencyMs: 1200,
        costUsd: history.reduce((sum, h) => sum + h.costUsd, 0) / history.length,
      });
    }
    return list;
  }
}

// ─── Main Learning Engine Orchestrator ────────────────────────────────────────

export class LearningEngine implements ILearningEngine {
  private _state: LearningState = LearningState.CREATED;
  private _sessions: LearningSession[] = [];

  constructor(
    public readonly context: any,
    private readonly _patternAnalyzer: IPatternAnalyzer = new DefaultPatternAnalyzer(),
    private readonly _knowledgeMgr: IKnowledgeManager = new DefaultKnowledgeManager(),
    private readonly _recommendationEngine: IRecommendationEngine = new DefaultRecommendationEngine(),
    private readonly _workflowLearner: IWorkflowLearner = new DefaultWorkflowLearner(),
    private readonly _promptLearner: IPromptLearner = new DefaultPromptLearner(),
    private readonly _decisionLearner: IDecisionLearner = new DefaultDecisionLearner(),
    private readonly _providerLearner: IProviderLearner = new DefaultProviderLearner(),
    public readonly metadata: Record<string, unknown> = {}
  ) {}

  public async initialize(): Promise<void> {
    LearningValidator.validateStateTransition("LearningEngine", this._state, LearningState.INITIALIZED);
    this._state = LearningState.INITIALIZED;
  }

  public async start(): Promise<void> {
    LearningValidator.validateStateTransition("LearningEngine", this._state, LearningState.COLLECTING);
    this._state = LearningState.COLLECTING;
  }

  public async stop(): Promise<void> {
    LearningValidator.validateStateTransition("LearningEngine", this._state, LearningState.FAILED);
    this._state = LearningState.FAILED;
  }

  get state(): LearningState {
    return this._state;
  }

  public getPatternAnalyzer(): IPatternAnalyzer { return this._patternAnalyzer; }
  public getSuccessAnalyzer(): ISuccessAnalyzer { return new DefaultSuccessAnalyzer(); }
  public getFailureAnalyzer(): IFailureAnalyzer { return new DefaultFailureAnalyzer(); }
  public getRecommendationEngine(): IRecommendationEngine { return this._recommendationEngine; }
  public getKnowledgeManager(): IKnowledgeManager { return this._knowledgeMgr; }
  public getWorkflowLearner(): IWorkflowLearner { return this._workflowLearner; }
  public getPromptLearner(): IPromptLearner { return this._promptLearner; }
  public getDecisionLearner(): IDecisionLearner { return this._decisionLearner; }
  public getProviderLearner(): IProviderLearner { return this._providerLearner; }

  // ─── Learning Cycle ─────────────────────────────────────────────────────────

  public async learn(request: LearningRequest, history: LearningHistory[]): Promise<LearningResponse> {
    LearningValidator.validateDatasetNotEmpty(history);
    for (const h of history) {
      LearningValidator.validateHistoryEntry(h);
    }

    this._state = LearningState.COLLECTING;
    await this._emit("LearningStarted", { requestId: request.id });

    // Step 1: Collect & validate history
    await this._emit("HistoryCollected", { recordCount: history.length });

    this._state = LearningState.ANALYZING;

    // Step 2: Extract patterns
    const generalPatterns = this._patternAnalyzer.analyze(history);
    const successPatterns = this.getSuccessAnalyzer().analyzeSuccess(history);
    const failurePatterns = this.getFailureAnalyzer().analyzeFailure(history);

    const allPatterns = [...generalPatterns, ...successPatterns, ...failurePatterns];
    LearningValidator.validateNoDuplicatePatterns(allPatterns);

    for (const pat of allPatterns) {
      LearningValidator.validateConfidence(pat.confidence);
      await this._emit("PatternDetected", { patternId: pat.id, type: pat.type });
    }

    this._state = LearningState.LEARNING;

    // Step 3: Run sub-learners
    const wfPatterns   = this._workflowLearner.learnWorkflow(history);
    const prPatterns   = this._promptLearner.learnPrompt(history);
    const decPatterns  = this._decisionLearner.learnDecision(history);
    const provPatterns = this._providerLearner.learnProvider(history);

    await this._emit("WorkflowLearned", { count: wfPatterns.length });
    await this._emit("PromptLearned", { count: prPatterns.length });
    await this._emit("ProviderLearned", { count: provPatterns.length });

    const totalLearnedPatterns = [...allPatterns, ...wfPatterns, ...prPatterns, ...decPatterns, ...provPatterns];

    // Step 4: Generate recommendations
    const recommendations = this._recommendationEngine.generateRecommendations(totalLearnedPatterns);
    for (const rec of recommendations) {
      LearningValidator.validateRecommendation(rec);
      await this._emit("RecommendationGenerated", { recommendationId: rec.id });
    }
    LearningValidator.validateOrphanRecommendations(recommendations, totalLearnedPatterns);

    this._state = LearningState.APPLYING;

    // Step 5: Update knowledge base
    const knowledgeEntries: KnowledgeEntry[] = totalLearnedPatterns.map(pat => ({
      id: `kn-${pat.id}`,
      type: pat.type === LearningType.FAILURE_PATTERN ? KnowledgeType.ANTI_PATTERN : KnowledgeType.PATTERN,
      target: pat.type === LearningType.PROMPT_PATTERN ? ImprovementTarget.GENERATION
        : pat.type === LearningType.WORKFLOW_PATTERN ? ImprovementTarget.GLOBAL
        : pat.type === LearningType.FAILURE_PATTERN ? ImprovementTarget.QUALITY
        : ImprovementTarget.PUBLISHING,
      title: pat.name,
      description: pat.description,
      confidence: pat.confidence,
      updatedAt: new Date(),
      dependencies: [],
    }));

    this._knowledgeMgr.updateKnowledge(knowledgeEntries);
    await this._emit("KnowledgeUpdated", { entriesCount: knowledgeEntries.length });

    // Step 6: Save snapshot to Memory
    const snap = this.getSnapshot();
    const ctx = this.context;
    if (ctx?.memoryStore) {
      await ctx.memoryStore.set("learning-history",    `history:${request.id}`, history.length);
      await ctx.memoryStore.set("learning-patterns",   `patterns:${request.id}`, totalLearnedPatterns.map(p => p.id));
      await ctx.memoryStore.set("knowledge-base",      `graph:${request.id}`, this._knowledgeMgr.listEntries().length);
      await ctx.memoryStore.set("recommendations",     `recs:${request.id}`, recommendations.map(r => r.id));
      await ctx.memoryStore.set("workflow-patterns",   `wf:${request.id}`, wfPatterns.length);
      await ctx.memoryStore.set("prompt-patterns",     `prompt:${request.id}`, prPatterns.length);
      await ctx.memoryStore.set("provider-patterns",   `provider:${request.id}`, provPatterns.length);
      await ctx.memoryStore.set("decision-patterns",   `decision:${request.id}`, decPatterns.length);
      await ctx.memoryStore.set("learning-snapshots",  `snap:${request.id}`, snap.id);
    }

    // Step 7: Feedback to Planning & Decision Engines
    if (ctx?.decisionEngine?.record) {
      await ctx.decisionEngine.record({
        learningRequestId: request.id,
        patternsExtractedCount: totalLearnedPatterns.length,
        recommendationsGeneratedCount: recommendations.length,
      });
    }

    if (ctx?.planningEngine?.createTask) {
      await ctx.planningEngine.createTask({
        type: "LEARNING_CYCLE_COMPLETE",
        requestId: request.id,
        insightsCount: recommendations.length,
      });
    }

    // Update state to COMPLETED
    this._state = LearningState.COMPLETED;
    await this._emit("LearningCompleted", { requestId: request.id });

    return {
      id: `lresp-${Date.now()}`,
      requestId: request.id,
      state: this._state,
      patterns: totalLearnedPatterns,
      recommendations,
      updatedKnowledgeEntries: knowledgeEntries.map(e => e.id),
      timestamp: new Date(),
    };
  }

  // ─── Snapshots & Reporting ──────────────────────────────────────────────────

  public getSnapshot(): LearningSnapshot {
    const graph = this._knowledgeMgr.getGraph();
    const snap: LearningSnapshot = {
      id: `lsnap-${Date.now()}`,
      state: this._state,
      knowledgeEntries: graph.entries,
      patterns: [],
      sessionStats: {
        accuracyBySource: { [LearningSource.ANALYTICS]: 0.85 },
        totalLearningCycles: 1,
        successRatio: 0.9,
      },
      timestamp: new Date(),
    };
    const frozen = deepFreeze(snap);
    LearningValidator.validateSnapshotIntegrity(frozen);
    return frozen;
  }

  public getReport(): LearningReport {
    const graph = this._knowledgeMgr.getGraph();
    return {
      id: `lreport-${Date.now()}`,
      metrics: {
        totalHistoryProcessed: 10,
        successfulExecutions: 8,
        failedExecutions: 2,
        patternsExtracted: 5,
        insightsGenerated: 4,
        averageAccuracy: 0.88,
      },
      statistics: {
        accuracyBySource: { [LearningSource.ANALYTICS]: 0.88 },
        totalLearningCycles: 1,
        successRatio: 0.8,
      },
      recentPatterns: [],
      recentRecommendations: [],
      generatedAt: new Date(),
    };
  }

  // ─── Helper Event Emitter ───────────────────────────────────────────────────

  private async _emit(name: string, payload: Record<string, unknown>): Promise<void> {
    if (this.context?.eventBus?.publish) {
      try {
        await this.context.eventBus.publish({
          id: `evt-${name.toLowerCase()}-${Math.random().toString(36).slice(2, 7)}`,
          name,
          timestamp: new Date(),
          source: "LearningEngine",
          payload,
          metadata: {},
        });
      } catch (_) {}
    }
  }
}
