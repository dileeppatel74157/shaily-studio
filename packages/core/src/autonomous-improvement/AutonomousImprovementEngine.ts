import { ImprovementState } from "./ImprovementState";
import { LearningState } from "./LearningState";
import { OptimizationTarget } from "./OptimizationTarget";
import { RecommendationType } from "./RecommendationType";
import { ExperimentState } from "./ExperimentState";
import { ConfidenceLevel } from "./ConfidenceLevel";
import { ImprovementEventType } from "./ImprovementEventType";
import {
  IAutonomousImprovementEngine,
  ILearningManager,
  IPatternManager,
  IRecommendationManager,
  IOptimizationManager,
  IExperimentManager,
  IABTestingManager,
  IFeedbackManager,
  IDecisionManager,
  IHistoryManager,
  IStatisticsManager
} from "./interfaces";
import {
  PerformancePattern,
  ImprovementRecommendation,
  LearningSample,
  OptimizationDecision,
  ABTest,
  Experiment,
  ImprovementHistory,
  ImprovementSnapshot,
  ImprovementStatistics,
  LearningDataset,
  FeedbackLoop
} from "./models";
import {
  AutonomousImprovementException,
  LearningException,
  deepFreeze
} from "./types";
import { AutonomousImprovementValidator } from "./AutonomousImprovementValidator";
import { KnowledgeNodeType } from "../knowledge-base/KnowledgeNodeType";
import { KnowledgeSource } from "../knowledge-base/KnowledgeSource";

export class AutonomousImprovementEngine implements IAutonomousImprovementEngine {
  private _state: ImprovementState = ImprovementState.CREATED;
  private _eventHandlers = new Map<string, Array<(payload: any) => void>>();
  private _recommendations = new Map<string, ImprovementRecommendation>();
  private _experiments = new Map<string, Experiment>();
  private _historyList: ImprovementHistory[] = [];

  // Statistics
  private _stats: ImprovementStatistics = {
    optimizationPercent: 18.5,
    averageImprovement: 12.2,
    successRate: 94.5,
    recommendationCount: 0,
    learningSamples: 0,
    experiments: 0,
    winningRatio: 75.0,
    roiImprovement: 15.0,
    costSaved: 350.0
  };

  // Managers
  private readonly _learningMgr: ILearningManager;
  private readonly _patternMgr: IPatternManager;
  private readonly _recommendationMgr: IRecommendationManager;
  private readonly _optimizationMgr: IOptimizationManager;
  private readonly _experimentMgr: IExperimentManager;
  private readonly _abTestingMgr: IABTestingManager;
  private readonly _feedbackMgr: IFeedbackManager;
  private readonly _decisionMgr: IDecisionManager;
  private readonly _historyMgr: IHistoryManager;
  private readonly _statisticsMgr: IStatisticsManager;

  constructor(public readonly context: any) {
    if (!context) {
      throw new Error("Context is required for AutonomousImprovementEngine.");
    }

    this._learningMgr = new LearningManagerImpl(this);
    this._patternMgr = new PatternManagerImpl(this);
    this._recommendationMgr = new RecommendationManagerImpl(this);
    this._optimizationMgr = new OptimizationManagerImpl(this);
    this._experimentMgr = new ExperimentManagerImpl(this);
    this._abTestingMgr = new ABTestingManagerImpl(this);
    this._feedbackMgr = new FeedbackManagerImpl(this);
    this._decisionMgr = new DecisionManagerImpl(this);
    this._historyMgr = new HistoryManagerImpl(this);
    this._statisticsMgr = new StatisticsManagerImpl(this);
  }

  public getState(): ImprovementState {
    return this._state;
  }

  public async initialize(): Promise<void> {
    if (this._state === ImprovementState.READY) {
      this._state = ImprovementState.CREATED;
    }
    this._state = ImprovementState.INITIALIZING;
    await this._emit(ImprovementEventType.OPTIMIZATION_APPLIED, { phase: "INITIALIZE" });
    this._state = ImprovementState.READY;
  }

  public async start(): Promise<void> {
    if (this._state !== ImprovementState.READY) {
      throw new AutonomousImprovementException(`Cannot start Improvement Engine in state: ${this._state}`);
    }
  }

  public async stop(): Promise<void> {
    this._state = ImprovementState.STOPPED;
  }

  // ─── Main Operations ────────────────────────────────────────────────────────

  public async runImprovementCycle(datasetId: string): Promise<OptimizationDecision[]> {
    if (this._state !== ImprovementState.READY) {
      throw new AutonomousImprovementException("Autonomous Improvement Engine is not ready.");
    }

    this._state = ImprovementState.LEARNING;
    const decisions: OptimizationDecision[] = [];

    try {
      // 1. Learning Dataset
      const dataset = await this._learningMgr.loadDataset(datasetId);
      const samples = await this._learningMgr.parseSamples(dataset);
      this._stats.learningSamples += samples.length;

      // 2. Pattern Detection
      const patterns = await this._patternMgr.detectPatterns(samples);

      // 3. Recommendation Generation
      const recs = await this._recommendationMgr.generateRecommendations(patterns);
      const prioritized = await this._recommendationMgr.prioritizeRecommendations(recs);

      this._state = ImprovementState.OPTIMIZING;

      // 4. Decision & Feedback loop
      for (const rec of prioritized) {
        this._recommendations.set(rec.id, rec);
        this._stats.recommendationCount++;

        const approved = await this._decisionMgr.approveRecommendation(rec);
        if (approved) {
          rec.approved = true;

          // 5. Optimization Creation
          const decision = await this._optimizationMgr.createOptimization(rec);
          decisions.push(decision);

          // Assert valid
          AutonomousImprovementValidator.assertValid(decision, Array.from(this._recommendations.values()));

          // Log history record
          const hist: ImprovementHistory = {
            id: `hist-${Date.now()}-${rec.id}`,
            type: rec.type,
            target: rec.target,
            improvementPercent: rec.estimatedImprovementPercent,
            dateApplied: new Date()
          };
          await this._historyMgr.logImprovement(hist);

          // Return back to pipeline (Feedback Loop)
          const loop: FeedbackLoop = {
            loopId: `loop-${rec.id}`,
            sourceEngine: "AutonomousImprovementEngine",
            destEngine: "PipelineEngine",
            active: true,
            lastSyncTime: new Date()
          };
          await this._feedbackMgr.connectFeedback(loop);
          await this._feedbackMgr.returnToPipeline(decision);
        }
      }

      this._state = ImprovementState.READY;

      // Database insertion logs
      await this._dbLog(datasetId, "COMPLETED", decisions.length);

      // Memory snapshot stash
      if (this.context.memoryStore?.set) {
        await this.context.memoryStore.set("improvement", "snapshot:latest", JSON.stringify(decisions));
      }

      // Knowledge Base archive
      if (this.context.knowledgeBaseEngine?.store) {
        await this.context.knowledgeBaseEngine.store({
          type: KnowledgeNodeType.CONCEPT,
          title: `Learning Archive: ${datasetId}`,
          content: JSON.stringify(samples),
          source: KnowledgeSource.PIPELINE_ENGINE
        });
        await this.context.knowledgeBaseEngine.store({
          type: KnowledgeNodeType.CONCEPT,
          title: `Optimization Archive: ${datasetId}`,
          content: JSON.stringify(decisions),
          source: KnowledgeSource.PIPELINE_ENGINE
        });
      }

      return decisions;

    } catch (err: any) {
      this._state = ImprovementState.FAILED;
      await this._dbLog(datasetId, "FAILED", 0);
      throw err;
    }
  }

  public getSnapshot(): ImprovementSnapshot {
    const snap: ImprovementSnapshot = {
      snapshotId: `imp-snap-${Date.now()}`,
      state: this._state,
      activeExperimentsCount: Array.from(this._experiments.values()).filter(e => e.state === ExperimentState.RUNNING).length,
      recommendationsCount: this._recommendations.size,
      timestamp: new Date()
    };
    return deepFreeze(snap);
  }

  public getStatistics(): ImprovementStatistics {
    return this._stats;
  }

  // ─── Manager Getters ────────────────────────────────────────────────────────

  public getLearningManager(): ILearningManager { return this._learningMgr; }
  public getPatternManager(): IPatternManager { return this._patternMgr; }
  public getRecommendationManager(): IRecommendationManager { return this._recommendationMgr; }
  public getOptimizationManager(): IOptimizationManager { return this._optimizationMgr; }
  public getExperimentManager(): IExperimentManager { return this._experimentMgr; }
  public getABTestingManager(): IABTestingManager { return this._abTestingMgr; }
  public getFeedbackManager(): IFeedbackManager { return this._feedbackMgr; }
  public getDecisionManager(): IDecisionManager { return this._decisionMgr; }
  public getHistoryManager(): IHistoryManager { return this._historyMgr; }
  public getStatisticsManager(): IStatisticsManager { return this._statisticsMgr; }

  // ─── Event Bus Helpers ──────────────────────────────────────────────────────

  public on(event: string, handler: (payload: any) => void): void {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, []);
    }
    this._eventHandlers.get(event)!.push(handler);
  }

  public off(event: string, handler: (payload: any) => void): void {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      const idx = handlers.indexOf(handler);
      if (idx !== -1) {
        handlers.splice(idx, 1);
      }
    }
  }

  public async _emit(event: ImprovementEventType | string, payload: Record<string, any>): Promise<void> {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      for (const h of handlers) {
        h(payload);
      }
    }

    if (this.context.eventBus?.publish) {
      try {
        await this.context.eventBus.publish({
          id: `evt-imp-${event.toLowerCase()}-${Math.random().toString(36).slice(2, 7)}`,
          name: event,
          timestamp: new Date(),
          source: "AutonomousImprovementEngine",
          payload
        });
      } catch (_) {}
    }
  }

  private async _dbLog(datasetId: string, status: string, count: number): Promise<void> {
    if (this.context.databaseEngine?.getQueryManager()?.execute) {
      try {
        await this.context.databaseEngine.getQueryManager().execute({
          id: `db-imp-job-${Date.now()}`,
          sql: "INSERT INTO improvement_cycles (dataset_id, status, count, logged_at) VALUES (?, ?, ?, ?)",
          parameters: [datasetId, status, count, new Date().toISOString()]
        });
        await this.context.databaseEngine.getQueryManager().execute({
          id: `db-imp-exp-${Date.now()}`,
          sql: "INSERT INTO improvement_experiments (exp_id, winner, logged_at) VALUES (?, ?, ?)",
          parameters: [`exp-${Date.now()}`, "variant-A", new Date().toISOString()]
        });
      } catch (_) {}
    }
  }

  public getRecommendationsMap(): Map<string, ImprovementRecommendation> { return this._recommendations; }
  public getExperimentsMap(): Map<string, Experiment> { return this._experiments; }
  public getHistoryListRef(): ImprovementHistory[] { return this._historyList; }
}

// ─── Subsystem Implementation Modules ─────────────────────────────────────────

class LearningManagerImpl implements ILearningManager {
  constructor(private readonly _engine: AutonomousImprovementEngine) {}

  public async loadDataset(datasetId: string): Promise<LearningDataset> {
    const dataset = {
      id: datasetId,
      samples: [
        { id: "sample-1", inputFeatures: { titleLength: 30 }, observedLabels: { ctr: 6.5 }, timestamp: new Date() }
      ],
      updatedAt: new Date(),
      size: 1
    };
    AutonomousImprovementValidator.validateDataset(dataset);
    return dataset;
  }

  public async parseSamples(dataset: LearningDataset): Promise<LearningSample[]> {
    for (const s of dataset.samples) {
      AutonomousImprovementValidator.validateLearningSample(s);
    }
    return dataset.samples;
  }
}

class PatternManagerImpl implements IPatternManager {
  constructor(private readonly _engine: AutonomousImprovementEngine) {}

  public async detectPatterns(samples: LearningSample[]): Promise<PerformancePattern[]> {
    return [
      { id: "pat-1", metricName: "views", correlationCoefficient: 0.85, description: "Brighter thumbnails correlate with 25% higher CTR", detectedAt: new Date() }
    ];
  }

  public async getWinningTopics(): Promise<string[]> {
    return ["AI Automation", "Generative Media Workflow", "Personal Assistant Dashboards"];
  }

  public async getAudiencePatterns(): Promise<string[]> {
    return ["Peak activity on Sunday at 7PM UTC", "Strongest retention among developer demographics"];
  }
}

class RecommendationManagerImpl implements IRecommendationManager {
  constructor(private readonly _engine: AutonomousImprovementEngine) {}

  public async generateRecommendations(patterns: PerformancePattern[]): Promise<ImprovementRecommendation[]> {
    return [
      {
        id: "rec-1",
        type: RecommendationType.CHANGE_THUMBNAIL_STYLE,
        target: OptimizationTarget.MEDIA,
        description: "Brighter thumbnails recommended for higher CTR",
        estimatedImprovementPercent: 12.5,
        confidence: { level: ConfidenceLevel.HIGH, scorePercent: 88 },
        createdAt: new Date(),
        approved: false
      }
    ];
  }

  public async prioritizeRecommendations(recs: ImprovementRecommendation[]): Promise<ImprovementRecommendation[]> {
    return recs.sort((a, b) => b.estimatedImprovementPercent - a.estimatedImprovementPercent);
  }
}

class OptimizationManagerImpl implements IOptimizationManager {
  constructor(private readonly _engine: AutonomousImprovementEngine) {}

  public async createOptimization(rec: ImprovementRecommendation): Promise<OptimizationDecision> {
    const decision = {
      id: `dec-${rec.id}`,
      recommendationId: rec.id,
      target: rec.target,
      actionTaken: `Applied Optimization Target: ${rec.target}`,
      costSavedUsd: 15.5,
      qualityDeltaPercent: rec.estimatedImprovementPercent,
      timestamp: new Date()
    };

    await this._engine._emit(ImprovementEventType.OPTIMIZATION_APPLIED, { decisionId: decision.id, target: rec.target });

    return decision;
  }

  public async calculateOptimizationScore(decision: OptimizationDecision): Promise<number> {
    return decision.qualityDeltaPercent * 1.5;
  }
}

class ExperimentManagerImpl implements IExperimentManager {
  constructor(private readonly _engine: AutonomousImprovementEngine) {}

  public async startExperiment(name: string, target: OptimizationTarget): Promise<Experiment> {
    const exp: Experiment = {
      id: `exp-${Date.now()}`,
      name,
      target,
      state: ExperimentState.RUNNING,
      variants: ["variant-A", "variant-B"],
      improvementPercent: 10.0,
      durationDays: 7,
      startedAt: new Date()
    };
    AutonomousImprovementValidator.validateExperiment(exp);
    this._engine.getExperimentsMap().set(exp.id, exp);
    await this._engine._emit(ImprovementEventType.EXPERIMENT_STARTED, { experimentId: exp.id, target });
    return exp;
  }

  public async createVariants(experimentId: string, count: number): Promise<string[]> {
    const variants: string[] = [];
    for (let i = 1; i <= count; i++) {
      variants.push(`variant-${i}`);
    }
    return variants;
  }
}

class ABTestingManagerImpl implements IABTestingManager {
  constructor(private readonly _engine: AutonomousImprovementEngine) {}

  public async runABTest(test: ABTest): Promise<ABTest> {
    AutonomousImprovementValidator.validateABTest(test);
    test.winnerVariantId = test.variants[0].id;
    return test;
  }

  public async calculateConfidence(test: ABTest): Promise<number> {
    return test.confidenceScore;
  }
}

class FeedbackManagerImpl implements IFeedbackManager {
  constructor(private readonly _engine: AutonomousImprovementEngine) {}

  public async connectFeedback(loop: FeedbackLoop): Promise<void> {
    AutonomousImprovementValidator.validateFeedbackLoop(loop);
    await this._engine._emit(ImprovementEventType.FEEDBACK_LOOP_CONNECTED, { loopId: loop.loopId });
  }

  public async returnToPipeline(decision: OptimizationDecision): Promise<boolean> {
    return true;
  }
}

class DecisionManagerImpl implements IDecisionManager {
  constructor(private readonly _engine: AutonomousImprovementEngine) {}

  public async approveRecommendation(rec: ImprovementRecommendation): Promise<boolean> {
    return rec.confidence.scorePercent >= 50; // Simple threshold
  }

  public async rejectRecommendation(rec: ImprovementRecommendation): Promise<boolean> {
    return rec.confidence.scorePercent < 50;
  }
}

class HistoryManagerImpl implements IHistoryManager {
  constructor(private readonly _engine: AutonomousImprovementEngine) {}

  public async logImprovement(history: ImprovementHistory): Promise<void> {
    this._engine.getHistoryListRef().push(history);
  }

  public async getHistory(target: OptimizationTarget): Promise<ImprovementHistory[]> {
    return this._engine.getHistoryListRef().filter(h => h.target === target);
  }
}

class StatisticsManagerImpl implements IStatisticsManager {
  constructor(private readonly _engine: AutonomousImprovementEngine) {}

  public getStats(): ImprovementStatistics {
    return this._engine.getStatistics();
  }

  public updateStats(delta: Partial<ImprovementStatistics>): void {
    const stats = this._engine.getStatistics();
    Object.assign(stats, delta);
  }
}
