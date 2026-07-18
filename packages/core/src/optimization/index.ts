// ─── Enums ────────────────────────────────────────────────────────────────────
export { OptimizationState }     from "./OptimizationState";
export { OptimizationTarget }    from "./OptimizationTarget";
export { OptimizationStrategy }  from "./OptimizationStrategy";
export { OptimizationPriority }  from "./OptimizationPriority";
export { OptimizationStatus }    from "./OptimizationStatus";
export { OptimizationSource }    from "./OptimizationSource";
export { OptimizationResult }    from "./OptimizationResult";

// ─── Models ───────────────────────────────────────────────────────────────────
export type {
  OptimizationRequest,
  OptimizationResponse,
  OptimizationJob,
  OptimizationRule,
  OptimizationCandidate,
  OptimizationRecommendation,
  OptimizationExecution,
  OptimizationHistory,
  OptimizationMetrics,
  OptimizationImpact,
  OptimizationReport,
  OptimizationSnapshot,
} from "./models";

// ─── Interfaces ───────────────────────────────────────────────────────────────
export type {
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

// ─── Engine ───────────────────────────────────────────────────────────────────
export { OptimizationEngine }    from "./OptimizationEngine";
export { OptimizationBuilder }   from "./OptimizationBuilder";
export { OptimizationValidator } from "./OptimizationValidator";

// ─── Exception Types ──────────────────────────────────────────────────────────
export {
  OptimizationException,
  RuleException,
  ImpactException,
  RollbackException,
  OptimizationValidationException,
  deepFreeze,
} from "./types";
