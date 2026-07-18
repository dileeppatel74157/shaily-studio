import { OptimizationState }     from "./OptimizationState";
import { OptimizationTarget }    from "./OptimizationTarget";
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

// ─── Optimization Engine ─────────────────────────────────────────────────────

export interface IOptimizationEngine {
  readonly state: OptimizationState;

  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;

  /** Execute optimization candidates pipeline based on request settings */
  optimize(request: OptimizationRequest, learningInsights: any[]): Promise<OptimizationResponse>;

  /** Retrieve the latest snapshot of active rules & candidates */
  getSnapshot(): OptimizationSnapshot;

  /** Get complete health & impact analysis report */
  getReport(): OptimizationReport;

  // Sub-optimizer exposures
  getPromptOptimizer(): IPromptOptimizer;
  getWorkflowOptimizer(): IWorkflowOptimizer;
  getDecisionOptimizer(): IDecisionOptimizer;
  getPlanningOptimizer(): IPlanningOptimizer;
  getGenerationOptimizer(): IGenerationOptimizer;
  getRenderOptimizer(): IRenderOptimizer;
  getProviderOptimizer(): IProviderOptimizer;
  getExecutor(): IOptimizationExecutor;
}

// ─── Sub-Optimizers ──────────────────────────────────────────────────────────

export interface IPromptOptimizer {
  optimizePrompts(insights: any[]): OptimizationCandidate[];
}

export interface IWorkflowOptimizer {
  optimizeWorkflow(insights: any[]): OptimizationCandidate[];
}

export interface IDecisionOptimizer {
  optimizeDecision(insights: any[]): OptimizationCandidate[];
}

export interface IPlanningOptimizer {
  optimizePlanning(insights: any[]): OptimizationCandidate[];
}

export interface IGenerationOptimizer {
  optimizeGeneration(insights: any[]): OptimizationCandidate[];
}

export interface IRenderOptimizer {
  optimizeRender(insights: any[]): OptimizationCandidate[];
}

export interface IProviderOptimizer {
  optimizeProvider(insights: any[]): OptimizationCandidate[];
}

// ─── Executor ────────────────────────────────────────────────────────────────

export interface IOptimizationExecutor {
  execute(candidate: OptimizationCandidate): Promise<OptimizationExecution>;
  rollback(executionId: string): Promise<void>;
  getHistory(): OptimizationExecution[];
}
