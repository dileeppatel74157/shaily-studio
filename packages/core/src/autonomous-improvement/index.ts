// ─── Enums ────────────────────────────────────────────────────────────────────
export { ImprovementState } from "./ImprovementState";
export { LearningState } from "./LearningState";
export { OptimizationTarget } from "./OptimizationTarget";
export { RecommendationType } from "./RecommendationType";
export { ExperimentState } from "./ExperimentState";
export { ConfidenceLevel } from "./ConfidenceLevel";
export { ImprovementEventType } from "./ImprovementEventType";
export { ImprovementValidationResult } from "./ImprovementValidationResult";

// ─── Models ───────────────────────────────────────────────────────────────────
export type {
  PerformancePattern,
  ImprovementRecommendation,
  LearningSample,
  OptimizationDecision,
  ABVariant,
  ABTest,
  Experiment,
  FailureAnalysis,
  HookPerformance,
  TitlePerformance,
  ThumbnailPerformance,
  PublishingWindow,
  AudiencePattern,
  ScriptPattern,
  RetentionPattern,
  TopicCluster,
  ProviderPerformance,
  ExecutionComparison,
  BudgetOptimization,
  QualityOptimization,
  LearningDataset,
  AutonomousAction,
  OptimizationMetric,
  FeedbackLoop,
  LearningCheckpoint,
  ImprovementHistory,
  OptimizationReport,
  ImprovementSnapshot,
  ImprovementStatistics,
  ImprovementValidationIssue,
  ImprovementValidationReport
} from "./models";

// ─── Interfaces ───────────────────────────────────────────────────────────────
export type {
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

// ─── Exceptions & Utilities ───────────────────────────────────────────────────
export {
  AutonomousImprovementException,
  LearningException,
  OptimizationException,
  ExperimentException,
  ConfidenceException,
  ValidationException,
  deepFreeze
} from "./types";

// ─── Engine, Builder, Validator ───────────────────────────────────────────────
export { AutonomousImprovementEngine } from "./AutonomousImprovementEngine";
export { AutonomousImprovementBuilder } from "./AutonomousImprovementBuilder";
export { AutonomousImprovementValidator } from "./AutonomousImprovementValidator";
