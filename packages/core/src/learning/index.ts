// ─── Enums ────────────────────────────────────────────────────────────────────
export { LearningState }           from "./LearningState";
export { LearningSource }          from "./LearningSource";
export { LearningType }            from "./LearningType";
export { PatternConfidence }       from "./PatternConfidence";
export { RecommendationPriority }  from "./RecommendationPriority";
export { KnowledgeType }           from "./KnowledgeType";
export { ImprovementTarget }       from "./ImprovementTarget";

// ─── Models ───────────────────────────────────────────────────────────────────
export type {
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

// ─── Interfaces ───────────────────────────────────────────────────────────────
export type {
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

// ─── Engine ───────────────────────────────────────────────────────────────────
export { LearningEngine }    from "./LearningEngine";
export { LearningBuilder }   from "./LearningBuilder";
export { LearningValidator } from "./LearningValidator";

// ─── Exception Types ──────────────────────────────────────────────────────────
export {
  LearningException,
  PatternException,
  KnowledgeException,
  RecommendationException,
  LearningValidationException,
  deepFreeze,
} from "./types";
