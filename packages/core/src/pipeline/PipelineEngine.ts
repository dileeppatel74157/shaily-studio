import { PipelineState }       from "./PipelineState";
import { PipelineStage }       from "./PipelineStage";
import { PipelinePriority }    from "./PipelinePriority";
import { PipelineStatus }      from "./PipelineStatus";
import { PipelineMode }        from "./PipelineMode";
import { ExecutionStrategy }   from "./ExecutionStrategy";
import { PipelineResult }      from "./PipelineResult";
import { deepFreeze }          from "./types";
import { PipelineValidator }   from "./PipelineValidator";
import type {
  IPipelineEngine,
  IStageExecutor,
  IRecoveryManager,
  ICheckpointManager,
  IExecutionScheduler,
  IPipelineMonitor,
} from "./interfaces";
import type {
  PipelineRequest,
  PipelineResponse,
  PipelineExecution,
  PipelineStageExecution,
  PipelineCheckpoint,
  PipelineFailure,
  PipelineRecovery,
  PipelineReport,
  PipelineSnapshot,
  PipelineTimeline,
} from "./models";

// ─── Default Manager Implementations ──────────────────────────────────────────

class DefaultStageExecutor implements IStageExecutor {
  public async executeStage(stage: PipelineStage, context: any): Promise<PipelineStatus> {
    const engineMap: Record<PipelineStage, string> = {
      [PipelineStage.RESEARCH]:     "researchEngine",
      [PipelineStage.STRATEGY]:     "strategyEngine",
      [PipelineStage.CHANNEL]:      "channelEngine",
      [PipelineStage.SCRIPT]:       "scriptEngine",
      [PipelineStage.PRODUCTION]:   "productionEngine",
      [PipelineStage.GENERATION]:   "generationEngine",
      [PipelineStage.COMPOSITION]:  "compositionEngine",
      [PipelineStage.RENDERING]:    "renderEngine",
      [PipelineStage.QUALITY]:      "qualityEngine",
      [PipelineStage.PUBLISHING]:   "publishingEngine",
      [PipelineStage.ANALYTICS]:    "analyticsEngine",
      [PipelineStage.LEARNING]:     "learningEngine",
      [PipelineStage.OPTIMIZATION]: "optimizationEngine",
    };

    const engineKey = engineMap[stage];
    const engineInstance = context?.[engineKey];

    // Simulate engine run if present or run real initialize/run logic
    if (engineInstance && typeof engineInstance.refresh === "function") {
      await engineInstance.refresh();
    }
    return PipelineStatus.SUCCESS;
  }

  public async rollbackStage(stage: PipelineStage, context: any): Promise<void> {
    // Rollback execution variables
  }
}

class DefaultRecoveryManager implements IRecoveryManager {
  private _failures: PipelineFailure[] = [];

  public async handleFailure(failure: PipelineFailure): Promise<PipelineRecovery> {
    this._failures.push(failure);
    const recId = `rec-${Date.now()}-${failure.id}`;
    const success = failure.canRetry;

    const recovery: PipelineRecovery = {
      id: recId,
      failureId: failure.id,
      strategy: success ? "RETRY" : "STOP",
      success,
      recoveredAt: new Date(),
    };
    PipelineValidator.validateRecovery(recovery);
    return recovery;
  }

  public getFailures(executionId?: string): PipelineFailure[] {
    return executionId ? this._failures.filter(f => f.executionId === executionId) : [...this._failures];
  }
}

class DefaultCheckpointManager implements ICheckpointManager {
  private _checkpoints = new Map<string, PipelineCheckpoint>();

  public saveCheckpoint(checkpoint: PipelineCheckpoint): void {
    PipelineValidator.validateCheckpoint(checkpoint);
    this._checkpoints.set(`${checkpoint.executionId}-${checkpoint.lastCompletedStage}`, checkpoint);
  }

  public loadCheckpoint(executionId: string): PipelineCheckpoint | undefined {
    const list = [...this._checkpoints.values()].filter(c => c.executionId === executionId);
    return list[list.length - 1];
  }

  public listCheckpoints(requestId?: string): PipelineCheckpoint[] {
    const list = [...this._checkpoints.values()];
    return requestId ? list.filter(c => c.requestId === requestId) : list;
  }
}

class DefaultExecutionScheduler implements IExecutionScheduler {
  public schedule(stages: PipelineStage[]): PipelineStage[][] {
    // For SEQUENTIAL: returns list of single item arrays
    return stages.map(s => [s]);
  }
}

class DefaultPipelineMonitor implements IPipelineMonitor {
  private _executions = new Map<string, PipelineExecution>();

  public trackExecution(execution: PipelineExecution): void {
    this._executions.set(execution.id, execution);
  }

  public getExecution(executionId: string): PipelineExecution | undefined {
    return this._executions.get(executionId);
  }

  public getActiveExecutions(): PipelineExecution[] {
    return [...this._executions.values()].filter(e => e.status === PipelineStatus.RUNNING);
  }
}

// ─── Main Pipeline Engine Orchestrator ────────────────────────────────────────

export class PipelineEngine implements IPipelineEngine {
  private _state: PipelineState = PipelineState.CREATED;
  private _activeExecution?: PipelineExecution;
  private _reports = new Map<string, PipelineReport>();

  constructor(
    public readonly context: any,
    private readonly _stageExecutor: IStageExecutor = new DefaultStageExecutor(),
    private readonly _recoveryMgr: IRecoveryManager = new DefaultRecoveryManager(),
    private readonly _checkpointMgr: ICheckpointManager = new DefaultCheckpointManager(),
    private readonly _scheduler: IExecutionScheduler = new DefaultExecutionScheduler(),
    private readonly _monitor: IPipelineMonitor = new DefaultPipelineMonitor(),
    public readonly metadata: Record<string, unknown> = {}
  ) {}

  public async initialize(): Promise<void> {
    PipelineValidator.validateStateTransition("PipelineEngine", this._state, PipelineState.INITIALIZED);
    this._state = PipelineState.INITIALIZED;
  }

  public async start(): Promise<void> {
    PipelineValidator.validateStateTransition("PipelineEngine", this._state, PipelineState.RUNNING);
    this._state = PipelineState.RUNNING;
  }

  public async stop(): Promise<void> {
    PipelineValidator.validateStateTransition("PipelineEngine", this._state, PipelineState.FAILED);
    this._state = PipelineState.FAILED;
  }

  public async pause(): Promise<void> {
    PipelineValidator.validateStateTransition("PipelineEngine", this._state, PipelineState.PAUSED);
    this._state = PipelineState.PAUSED;
    await this._emit("PipelinePaused", { executionId: this._activeExecution?.id });
  }

  public async resume(): Promise<void> {
    PipelineValidator.validateStateTransition("PipelineEngine", this._state, PipelineState.RUNNING);
    this._state = PipelineState.RUNNING;
    await this._emit("PipelineResumed", { executionId: this._activeExecution?.id });
  }

  get state(): PipelineState {
    return this._state;
  }

  public getStageExecutor(): IStageExecutor { return this._stageExecutor; }
  public getRecoveryManager(): IRecoveryManager { return this._recoveryMgr; }
  public getCheckpointManager(): ICheckpointManager { return this._checkpointMgr; }
  public getExecutionScheduler(): IExecutionScheduler { return this._scheduler; }
  public getMonitor(): IPipelineMonitor { return this._monitor; }

  // ─── Pipeline Execution ─────────────────────────────────────────────────────

  public async execute(request: PipelineRequest): Promise<PipelineResponse> {
    PipelineValidator.validateNoDuplicateStages(request.stages);
    PipelineValidator.validateRequiredEnginesPresent(this.context);

    // Validate timeout configurations
    PipelineValidator.validateTimeout((request.metadata?.timeoutMs as number) ?? 3600_000);

    const executionId = `exec-${Date.now()}`;
    await this._emit("PipelineStarted", { requestId: request.id, executionId });

    const stageExecutions: PipelineStageExecution[] = request.stages.map(stage => ({
      stage,
      status: PipelineStatus.PENDING,
      retryCount: 0,
    }));

    const execution: PipelineExecution = {
      id: executionId,
      requestId: request.id,
      mode: request.mode,
      stages: stageExecutions,
      status: PipelineStatus.RUNNING,
      startedAt: new Date(),
    };

    this._activeExecution = execution;
    this._monitor.trackExecution(execution);

    let result = PipelineResult.SUCCESS;
    const completedStages: PipelineStage[] = [];

    // Schedule execution graph
    const scheduledGroups = this._scheduler.schedule(request.stages);

    for (const group of scheduledGroups) {
      if (this._state === PipelineState.PAUSED) {
        // block/wait loop simulated or paused state check
        break;
      }

      // Sequential or Parallel scheduling logic
      if (request.mode === PipelineMode.PARALLEL || request.mode === PipelineMode.HYBRID) {
        // Parallel group execution simulation
        await Promise.all(group.map(stage => this._runStage(execution, stage, completedStages)));
      } else {
        // Sequential linear flow
        for (const stage of group) {
          const success = await this._runStage(execution, stage, completedStages);
          if (!success) {
            result = PipelineResult.FAILURE;
            break;
          }
        }
      }

      if (result === PipelineResult.FAILURE) {
        break;
      }
    }

    execution.status = result === PipelineResult.SUCCESS ? PipelineStatus.SUCCESS : PipelineStatus.FAILED;
    execution.completedAt = new Date();
    execution.totalDurationMs = execution.completedAt.getTime() - execution.startedAt.getTime();

    // Create execution report
    const timeline: PipelineTimeline = {
      id: `time-${Date.now()}`,
      executionId,
      events: completedStages.map(s => ({
        id: `ev-${Date.now()}-${s}`, stage: s, status: PipelineStatus.SUCCESS, timestamp: new Date(),
      })),
      startedAt: execution.startedAt,
      updatedAt: new Date(),
    };

    const report: PipelineReport = {
      id: `rep-${Date.now()}`,
      executionId,
      metrics: {
        stageDurationsMs: request.stages.reduce((acc, s) => { acc[s] = 100; return acc; }, {} as Record<PipelineStage, number>),
        totalRetries: 0,
        costUsd: 0.50,
        successRate: result === PipelineResult.SUCCESS ? 1.0 : 0.0,
      },
      timeline,
      result,
      generatedAt: new Date(),
    };
    this._reports.set(executionId, report);

    // Save to Memory
    const ctx = this.context;
    if (ctx?.memoryStore) {
      await ctx.memoryStore.set("pipeline-history",     `history:${request.id}`, request.goal);
      await ctx.memoryStore.set("pipeline-checkpoints",   `checkpoints:${request.id}`, completedStages.length);
      await ctx.memoryStore.set("pipeline-executions",    `exec:${request.id}`, executionId);
      await ctx.memoryStore.set("pipeline-failures",      `failures:${request.id}`, this._recoveryMgr.getFailures(executionId).length);
      await ctx.memoryStore.set("pipeline-metrics",       `metrics:${request.id}`, report.metrics.successRate);
      await ctx.memoryStore.set("pipeline-snapshots",     `snap:${request.id}`, execution.status);
      await ctx.memoryStore.set("pipeline-recovery",      `recovery:${request.id}`, 0);
    }

    // Feedback integration to Decision & Planning Engines
    if (ctx?.decisionEngine?.record) {
      await ctx.decisionEngine.record({
        pipelineExecutionId: executionId,
        goal: request.goal,
        status: execution.status,
        stagesExecutedCount: completedStages.length,
      });
    }

    if (ctx?.planningEngine?.createTask) {
      await ctx.planningEngine.createTask({
        type: "AUTONOMOUS_PIPELINE_COMPLETE",
        requestId: request.id,
        status: execution.status,
      });
    }

    await this._emit(result === PipelineResult.SUCCESS ? "PipelineCompleted" : "PipelineFailed", { executionId });

    return {
      id: `presp-${Date.now()}`,
      requestId: request.id,
      result,
      completedStages,
      executionTimeMs: execution.totalDurationMs,
      snapshotId: `snap-${executionId}`,
      timestamp: new Date(),
    };
  }

  // ─── Snapshots & Reporting ──────────────────────────────────────────────────

  public getSnapshot(): PipelineSnapshot {
    const snap: PipelineSnapshot = {
      id: `psnap-${Date.now()}`,
      state: this._state,
      activeExecution: this._activeExecution,
      metrics: {
        stageDurationsMs: {} as Record<PipelineStage, number>,
        totalRetries: 0,
        costUsd: 0.0,
        successRate: 1.0,
      },
      timestamp: new Date(),
    };
    const frozen = deepFreeze(snap);
    PipelineValidator.validateSnapshotIntegrity(frozen);
    return frozen;
  }

  public getReport(executionId: string): PipelineReport | undefined {
    return this._reports.get(executionId);
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private async _runStage(execution: PipelineExecution, stage: PipelineStage, completedStages: PipelineStage[]): Promise<boolean> {
    const stageExec = execution.stages.find(s => s.stage === stage)!;
    stageExec.status = PipelineStatus.RUNNING;
    stageExec.startedAt = new Date();
    execution.currentStage = stage;

    await this._emit("StageStarted", { executionId: execution.id, stage });

    let status = PipelineStatus.FAILED;
    let errorMessage: string | undefined;

    try {
      status = await this._stageExecutor.executeStage(stage, this.context);
    } catch (e: any) {
      errorMessage = e.message;
    }

    stageExec.status = status;
    stageExec.completedAt = new Date();
    stageExec.durationMs = stageExec.completedAt.getTime() - stageExec.startedAt.getTime();

    if (status === PipelineStatus.SUCCESS) {
      completedStages.push(stage);
      await this._emit("StageCompleted", { executionId: execution.id, stage });

      // Save Checkpoint after each successfully completed stage
      const checkpoint: PipelineCheckpoint = {
        id: `chk-${Date.now()}-${stage}`,
        requestId: execution.requestId,
        executionId: execution.id,
        lastCompletedStage: stage,
        stageResults: { completed: true },
        savedAt: new Date(),
      };
      this._checkpointMgr.saveCheckpoint(checkpoint);
      await this._emit("CheckpointSaved", { checkpointId: checkpoint.id, executionId: execution.id });

      return true;
    } else {
      stageExec.errorMessage = errorMessage;
      await this._emit("StageFailed", { executionId: execution.id, stage, error: errorMessage });

      // Try Recovery Manager
      const failure: PipelineFailure = {
        id: `fail-${Date.now()}-${stage}`,
        executionId: execution.id,
        failedStage: stage,
        reason: errorMessage ?? "Unknown engine error",
        occurredAt: new Date(),
        canRetry: stageExec.retryCount < 1, // allow 1 retry in tests
      };

      await this._emit("RecoveryStarted", { failureId: failure.id, stage });
      const recovery = await this._recoveryMgr.handleFailure(failure);
      await this._emit("RecoveryCompleted", { recoveryId: recovery.id, success: recovery.success });

      if (recovery.success && recovery.strategy === "RETRY") {
        stageExec.retryCount++;
        // Retry execution
        return this._runStage(execution, stage, completedStages);
      }

      return false;
    }
  }

  private async _emit(name: string, payload: Record<string, unknown>): Promise<void> {
    if (this.context?.eventBus?.publish) {
      try {
        await this.context.eventBus.publish({
          id: `evt-${name.toLowerCase()}-${Math.random().toString(36).slice(2, 7)}`,
          name,
          timestamp: new Date(),
          source: "PipelineEngine",
          payload,
          metadata: {},
        });
      } catch (_) {}
    }
  }
}
