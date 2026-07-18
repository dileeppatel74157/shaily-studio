import { OptimizationEngine } from "./OptimizationEngine";
import { OptimizationValidationException } from "./types";
import type {
  IPromptOptimizer,
  IWorkflowOptimizer,
  IDecisionOptimizer,
  IPlanningOptimizer,
  IGenerationOptimizer,
  IRenderOptimizer,
  IProviderOptimizer,
  IOptimizationExecutor,
} from "./interfaces";

export class OptimizationBuilder {
  private _context?: any;
  private _metadata: Record<string, unknown> = {};

  private _promptOptimizer?: IPromptOptimizer;
  private _workflowOptimizer?: IWorkflowOptimizer;
  private _decisionOptimizer?: IDecisionOptimizer;
  private _planningOptimizer?: IPlanningOptimizer;
  private _generationOptimizer?: IGenerationOptimizer;
  private _renderOptimizer?: IRenderOptimizer;
  private _providerOptimizer?: IProviderOptimizer;
  private _executor?: IOptimizationExecutor;

  public withContext(context: any): this {
    this._context = context;
    return this;
  }

  public withMetadata(metadata: Record<string, unknown>): this {
    this._metadata = { ...metadata };
    return this;
  }

  public withPromptOptimizer(optimizer: IPromptOptimizer): this {
    this._promptOptimizer = optimizer;
    return this;
  }

  public withWorkflowOptimizer(optimizer: IWorkflowOptimizer): this {
    this._workflowOptimizer = optimizer;
    return this;
  }

  public withDecisionOptimizer(optimizer: IDecisionOptimizer): this {
    this._decisionOptimizer = optimizer;
    return this;
  }

  public withPlanningOptimizer(optimizer: IPlanningOptimizer): this {
    this._planningOptimizer = optimizer;
    return this;
  }

  public withGenerationOptimizer(optimizer: IGenerationOptimizer): this {
    this._generationOptimizer = optimizer;
    return this;
  }

  public withRenderOptimizer(optimizer: IRenderOptimizer): this {
    this._renderOptimizer = optimizer;
    return this;
  }

  public withProviderOptimizer(optimizer: IProviderOptimizer): this {
    this._providerOptimizer = optimizer;
    return this;
  }

  public withExecutor(executor: IOptimizationExecutor): this {
    this._executor = executor;
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

  public build(): OptimizationEngine {
    if (!this._context) {
      throw new OptimizationValidationException("Context is required to build an OptimizationEngine.");
    }
    return new OptimizationEngine(
      this._context,
      this._promptOptimizer,
      this._workflowOptimizer,
      this._decisionOptimizer,
      this._planningOptimizer,
      this._generationOptimizer,
      this._renderOptimizer,
      this._providerOptimizer,
      this._executor,
      this._metadata
    );
  }
}
