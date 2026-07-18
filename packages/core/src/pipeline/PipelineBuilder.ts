import { PipelineEngine } from "./PipelineEngine";
import { PipelineValidationException } from "./types";
import type {
  IStageExecutor,
  IRecoveryManager,
  ICheckpointManager,
  IExecutionScheduler,
  IPipelineMonitor,
} from "./interfaces";

export class PipelineBuilder {
  private _context?: any;
  private _metadata: Record<string, unknown> = {};

  private _stageExecutor?: IStageExecutor;
  private _recoveryManager?: IRecoveryManager;
  private _checkpointManager?: ICheckpointManager;
  private _executionScheduler?: IExecutionScheduler;
  private _monitor?: IPipelineMonitor;

  public withContext(context: any): this {
    this._context = context;
    return this;
  }

  public withMetadata(metadata: Record<string, unknown>): this {
    this._metadata = { ...metadata };
    return this;
  }

  public withStageExecutor(executor: IStageExecutor): this {
    this._stageExecutor = executor;
    return this;
  }

  public withRecoveryManager(manager: IRecoveryManager): this {
    this._recoveryManager = manager;
    return this;
  }

  public withCheckpointManager(manager: ICheckpointManager): this {
    this._checkpointManager = manager;
    return this;
  }

  public withExecutionScheduler(scheduler: IExecutionScheduler): this {
    this._executionScheduler = scheduler;
    return this;
  }

  public withMonitor(monitor: IPipelineMonitor): this {
    this._monitor = monitor;
    return this;
  }

  public withMemory(memoryStore: any): this {
    if (!this._context) this._context = {};
    this._context.memoryStore = memoryStore;
    return this;
  }

  public withDecision(decisionEngine: any): this {
    if (!this._context) this._context = {};
    this._context.decisionEngine = decisionEngine;
    return this;
  }

  public withPlanner(planningEngine: any): this {
    if (!this._context) this._context = {};
    this._context.planningEngine = planningEngine;
    return this;
  }

  public build(): PipelineEngine {
    if (!this._context) {
      throw new PipelineValidationException("Context is required to build a PipelineEngine.");
    }
    return new PipelineEngine(
      this._context,
      this._stageExecutor,
      this._recoveryManager,
      this._checkpointManager,
      this._executionScheduler,
      this._monitor,
      this._metadata
    );
  }
}
