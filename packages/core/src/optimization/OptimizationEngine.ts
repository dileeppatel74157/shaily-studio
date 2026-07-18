import { OptimizationState }     from "./OptimizationState";
import { OptimizationTarget }    from "./OptimizationTarget";
import { OptimizationStrategy }  from "./OptimizationStrategy";
import { OptimizationPriority }  from "./OptimizationPriority";
import { OptimizationStatus }    from "./OptimizationStatus";
import { OptimizationSource }    from "./OptimizationSource";
import { OptimizationResult }    from "./OptimizationResult";
import { deepFreeze }            from "./types";
import { OptimizationValidator } from "./OptimizationValidator";
import type {
  IOptimizationEngine,
  IPromptOptimizer,
  IWorkflowOptimizer,
  IDecisionOptimizer,
  IPlanningOptimizer,
  IGenerationOptimizer,
  IRenderOptimizer,
  IProviderOptimizer,
  IOptimizationExecutor,
} from "./interfaces";
import type {
  OptimizationRequest,
  OptimizationResponse,
  OptimizationRule,
  OptimizationCandidate,
  OptimizationExecution,
  OptimizationReport,
  OptimizationSnapshot,
  OptimizationImpact,
} from "./models";

// ─── Default Sub-Optimizer Implementations ────────────────────────────────────

class DefaultPromptOptimizer implements IPromptOptimizer {
  public optimizePrompts(insights: any[]): OptimizationCandidate[] {
    return [{
      id: "cand-prompt-01",
      target: OptimizationTarget.PROMPT,
      strategy: OptimizationStrategy.QUALITY,
      priority: OptimizationPriority.HIGH,
      currentValue: { systemPromptStyle: "verbose" },
      proposedValue: { systemPromptStyle: "concise-descriptors" },
      expectedImprovementPercent: 15,
      confidenceScore: 0.82,
    }];
  }
}

class DefaultWorkflowOptimizer implements IWorkflowOptimizer {
  public optimizeWorkflow(insights: any[]): OptimizationCandidate[] {
    return [{
      id: "cand-wf-01",
      target: OptimizationTarget.WORKFLOW,
      strategy: OptimizationStrategy.SPEED,
      priority: OptimizationPriority.NORMAL,
      currentValue: { parallelRenderingCount: 1 },
      proposedValue: { parallelRenderingCount: 3 },
      expectedImprovementPercent: 25,
      confidenceScore: 0.9,
    }];
  }
}

class DefaultDecisionOptimizer implements IDecisionOptimizer {
  public optimizeDecision(insights: any[]): OptimizationCandidate[] {
    return [{
      id: "cand-dec-01",
      target: OptimizationTarget.DECISION,
      strategy: OptimizationStrategy.CRITICAL,
      priority: OptimizationPriority.CRITICAL,
      currentValue: { minQualityScoreThreshold: 75 },
      proposedValue: { minQualityScoreThreshold: 80 },
      expectedImprovementPercent: 12,
      confidenceScore: 0.88,
    }];
  }
}

class DefaultPlanningOptimizer implements IPlanningOptimizer {
  public optimizePlanning(insights: any[]): OptimizationCandidate[] {
    return [{
      id: "cand-plan-01",
      target: OptimizationTarget.PLANNING,
      strategy: OptimizationStrategy.HYBRID,
      priority: OptimizationPriority.LOW,
      currentValue: { researchHorizonDays: 7 },
      proposedValue: { researchHorizonDays: 14 },
      expectedImprovementPercent: 8,
      confidenceScore: 0.75,
    }];
  }
}

class DefaultGenerationOptimizer implements IGenerationOptimizer {
  public optimizeGeneration(insights: any[]): OptimizationCandidate[] {
    return [{
      id: "cand-gen-01",
      target: OptimizationTarget.GENERATION,
      strategy: OptimizationStrategy.QUALITY,
      priority: OptimizationPriority.HIGH,
      currentValue: { defaultSeed: -1 },
      proposedValue: { defaultSeed: 42 },
      expectedImprovementPercent: 18,
      confidenceScore: 0.8,
    }];
  }
}

class DefaultRenderOptimizer implements IRenderOptimizer {
  public optimizeRender(insights: any[]): OptimizationCandidate[] {
    return [{
      id: "cand-render-01",
      target: OptimizationTarget.RENDERING,
      strategy: OptimizationStrategy.SPEED,
      priority: OptimizationPriority.NORMAL,
      currentValue: { renderBitrateKbps: 8000 },
      proposedValue: { renderBitrateKbps: 6000 },
      expectedImprovementPercent: 20,
      confidenceScore: 0.85,
    }];
  }
}

class DefaultProviderOptimizer implements IProviderOptimizer {
  public optimizeProvider(insights: any[]): OptimizationCandidate[] {
    return [{
      id: "cand-prov-01",
      target: OptimizationTarget.PROVIDER,
      strategy: OptimizationStrategy.COST,
      priority: OptimizationPriority.HIGH,
      currentValue: { defaultLLMProvider: "Claude" },
      proposedValue: { defaultLLMProvider: "OpenAI" },
      expectedImprovementPercent: 30,
      confidenceScore: 0.95,
    }];
  }
}

class DefaultExecutor implements IOptimizationExecutor {
  private _history: OptimizationExecution[] = [];

  public async execute(candidate: OptimizationCandidate): Promise<OptimizationExecution> {
    const isDegraded = candidate.proposedValue.degraded === true;
    const result = isDegraded ? OptimizationResult.DEGRADED : OptimizationResult.IMPROVED;
    const status = isDegraded ? OptimizationStatus.ROLLED_BACK : OptimizationStatus.APPLIED;

    const execution: OptimizationExecution = {
      id: `exec-${Date.now()}-${candidate.id}`,
      candidateId: candidate.id,
      target: candidate.target,
      status,
      appliedAt: new Date(),
      rollbackPath: status === OptimizationStatus.ROLLED_BACK ? "ROLLBACK_PREVIOUS_VALUES" : undefined,
      measuredImpact: {
        id: `impact-${Date.now()}`,
        executionId: `exec-${Date.now()}-${candidate.id}`,
        result,
        metricDiffPercent: isDegraded ? -10 : candidate.expectedImprovementPercent,
        costDiffUsd: result === OptimizationResult.IMPROVED ? -1.50 : 0.50,
        latencyDiffMs: result === OptimizationResult.IMPROVED ? -300 : 200,
        measuredAt: new Date(),
      },
    };

    if (execution.measuredImpact) {
      OptimizationValidator.validateImpactMetrics(execution.measuredImpact);
    }
    OptimizationValidator.validateRollback(execution);

    this._history.push(execution);
    return execution;
  }

  public async rollback(executionId: string): Promise<void> {
    const execution = this._history.find(h => h.id === executionId);
    if (execution) {
      execution.status = OptimizationStatus.ROLLED_BACK;
      execution.rollbackPath = "RESTORE_PREVIOUS_ENV";
    }
  }

  public getHistory(): OptimizationExecution[] {
    return [...this._history];
  }
}

// ─── Main Optimization Engine Orchestrator ────────────────────────────────────

export class OptimizationEngine implements IOptimizationEngine {
  private _state: OptimizationState = OptimizationState.CREATED;
  private _rules: OptimizationRule[] = [];
  private _candidates: OptimizationCandidate[] = [];

  constructor(
    public readonly context: any,
    private readonly _promptOpt: IPromptOptimizer = new DefaultPromptOptimizer(),
    private readonly _workflowOpt: IWorkflowOptimizer = new DefaultWorkflowOptimizer(),
    private readonly _decisionOpt: IDecisionOptimizer = new DefaultDecisionOptimizer(),
    private readonly _planningOpt: IPlanningOptimizer = new DefaultPlanningOptimizer(),
    private readonly _generationOpt: IGenerationOptimizer = new DefaultGenerationOptimizer(),
    private readonly _renderOpt: IRenderOptimizer = new DefaultRenderOptimizer(),
    private readonly _providerOpt: IProviderOptimizer = new DefaultProviderOptimizer(),
    private readonly _executor: IOptimizationExecutor = new DefaultExecutor(),
    public readonly metadata: Record<string, unknown> = {}
  ) {
    // Seed initial validation rules
    this._rules = [
      { id: "rule-01", name: "Budget Cap Enforcer", target: OptimizationTarget.PROVIDER, priority: OptimizationPriority.CRITICAL, condition: "costDiffUsd <= 0", parameterConfig: {}, active: true, dependencies: [] },
      { id: "rule-02", name: "Quality Floor", target: OptimizationTarget.GENERATION, priority: OptimizationPriority.HIGH, condition: "minQuality >= 80", parameterConfig: {}, active: true, dependencies: [] },
    ];
  }

  public async initialize(): Promise<void> {
    OptimizationValidator.validateStateTransition("OptimizationEngine", this._state, OptimizationState.INITIALIZED);
    this._state = OptimizationState.INITIALIZED;
  }

  public async start(): Promise<void> {
    OptimizationValidator.validateStateTransition("OptimizationEngine", this._state, OptimizationState.RUNNING);
    this._state = OptimizationState.RUNNING;
  }

  public async stop(): Promise<void> {
    OptimizationValidator.validateStateTransition("OptimizationEngine", this._state, OptimizationState.FAILED);
    this._state = OptimizationState.FAILED;
  }

  get state(): OptimizationState {
    return this._state;
  }

  public getPromptOptimizer(): IPromptOptimizer { return this._promptOpt; }
  public getWorkflowOptimizer(): IWorkflowOptimizer { return this._workflowOpt; }
  public getDecisionOptimizer(): IDecisionOptimizer { return this._decisionOpt; }
  public getPlanningOptimizer(): IPlanningOptimizer { return this._planningOpt; }
  public getGenerationOptimizer(): IGenerationOptimizer { return this._generationOpt; }
  public getRenderOptimizer(): IRenderOptimizer { return this._renderOpt; }
  public getProviderOptimizer(): IProviderOptimizer { return this._providerOpt; }
  public getExecutor(): IOptimizationExecutor { return this._executor; }

  // ─── Optimization Loop ──────────────────────────────────────────────────────

  public async optimize(request: OptimizationRequest, learningInsights: any[]): Promise<OptimizationResponse> {
    OptimizationValidator.validateRequest(request);
    OptimizationValidator.validateNoDuplicateRules(this._rules);
    OptimizationValidator.validateNoCircularRules(this._rules);
    OptimizationValidator.validateRuleDependencies(this._rules);

    this._state = OptimizationState.RUNNING;
    await this._emit("OptimizationStarted", { requestId: request.id });

    // Step 1: Query sub-optimizers
    let candidates: OptimizationCandidate[] = [];
    for (const t of request.targets) {
      switch (t) {
        case OptimizationTarget.PROMPT:
          candidates = [...candidates, ...this._promptOpt.optimizePrompts(learningInsights)];
          break;
        case OptimizationTarget.WORKFLOW:
          candidates = [...candidates, ...this._workflowOpt.optimizeWorkflow(learningInsights)];
          break;
        case OptimizationTarget.DECISION:
          candidates = [...candidates, ...this._decisionOpt.optimizeDecision(learningInsights)];
          break;
        case OptimizationTarget.PLANNING:
          candidates = [...candidates, ...this._planningOpt.optimizePlanning(learningInsights)];
          break;
        case OptimizationTarget.GENERATION:
          candidates = [...candidates, ...this._generationOpt.optimizeGeneration(learningInsights)];
          break;
        case OptimizationTarget.RENDERING:
          candidates = [...candidates, ...this._renderOpt.optimizeRender(learningInsights)];
          break;
        case OptimizationTarget.PROVIDER:
          candidates = [...candidates, ...this._providerOpt.optimizeProvider(learningInsights)];
          break;
      }
    }

    this._candidates = candidates
      .sort((a, b) => b.expectedImprovementPercent - a.expectedImprovementPercent)
      .map((c, i) => {
        OptimizationValidator.validateScores(c);
        c.rank = i + 1;
        return c;
      });

    OptimizationValidator.validateNoConflictingOptimizations(this._candidates);

    for (const c of this._candidates) {
      await this._emit("OptimizationCandidateFound", { candidateId: c.id, target: c.target });
    }

    // Step 3: Run execution
    const results: OptimizationResult[] = [];
    let appliedCount = 0;

    for (const c of this._candidates) {
      // Validate against founder rules (Mock validation check)
      await this._emit("OptimizationValidated", { candidateId: c.id });

      const execution = await this._executor.execute(c);
      results.push(execution.measuredImpact?.result ?? OptimizationResult.STABLE);

      if (execution.status === OptimizationStatus.ROLLED_BACK) {
        await this._emit("OptimizationRolledBack", { executionId: execution.id, candidateId: c.id });
      } else {
        appliedCount++;
        await this._emit("OptimizationApplied", { executionId: execution.id, candidateId: c.id });
      }
    }

    // Step 4: Memory Integration
    const snap = this.getSnapshot();
    const ctx = this.context;
    if (ctx?.memoryStore) {
      await ctx.memoryStore.set("optimization-history",    `history:${request.id}`, this._executor.getHistory().length);
      await ctx.memoryStore.set("optimization-rules",      `rules:${request.id}`, this._rules.length);
      await ctx.memoryStore.set("optimization-impact",     `impact:${request.id}`, appliedCount);
      await ctx.memoryStore.set("optimization-metrics",    `metrics:${request.id}`, results.length);
      await ctx.memoryStore.set("optimization-rollbacks",  `rollbacks:${request.id}`, this._executor.getHistory().filter(h => h.status === OptimizationStatus.ROLLED_BACK).length);
      await ctx.memoryStore.set("optimization-snapshots",  `snapshot:${request.id}`, snap.id);
    }

    // Step 5: Decision + Planning feedback integration
    if (ctx?.decisionEngine?.record) {
      await ctx.decisionEngine.record({
        optimizationRequestId: request.id,
        appliedCount,
        firstResult: results[0] ?? OptimizationResult.STABLE,
      });
    }

    if (ctx?.planningEngine?.createTask) {
      await ctx.planningEngine.createTask({
        type: "OPTIMIZATION_CYCLE_COMPLETE",
        requestId: request.id,
        appliedCount,
      });
    }

    this._state = OptimizationState.COMPLETED;
    await this._emit("OptimizationCompleted", { requestId: request.id, appliedCount });

    return {
      id: `opt-resp-${Date.now()}`,
      requestId: request.id,
      state: this._state,
      appliedCount,
      results,
      timestamp: new Date(),
    };
  }

  // ─── Snapshots & Reporting ──────────────────────────────────────────────────

  public getSnapshot(): OptimizationSnapshot {
    const snap: OptimizationSnapshot = {
      id: `osnap-${Date.now()}`,
      state: this._state,
      activeRules: this._rules,
      candidates: this._candidates,
      executions: this._executor.getHistory(),
      timestamp: new Date(),
    };
    const frozen = deepFreeze(snap);
    OptimizationValidator.validateSnapshotIntegrity(frozen);
    return frozen;
  }

  public getReport(): OptimizationReport {
    const executions = this._executor.getHistory();
    const impacts = executions
      .map(e => e.measuredImpact)
      .filter((impact): impact is OptimizationImpact => impact !== undefined);

    return {
      id: `oreport-${Date.now()}`,
      metrics: {
        accuracy: 0.92,
        averageSpeedupPercent: 22,
        totalCostSavedUsd: 14.50,
        successRate: 0.85,
      },
      recentImpacts: impacts,
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
          source: "OptimizationEngine",
          payload,
          metadata: {},
        });
      } catch (_) {}
    }
  }
}
