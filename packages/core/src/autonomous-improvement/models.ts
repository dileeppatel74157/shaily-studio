import { ImprovementState } from "./ImprovementState";
import { LearningState } from "./LearningState";
import { OptimizationTarget } from "./OptimizationTarget";
import { RecommendationType } from "./RecommendationType";
import { ExperimentState } from "./ExperimentState";
import { ConfidenceLevel } from "./ConfidenceLevel";

export interface ConfidenceScore {
  level: ConfidenceLevel;
  scorePercent: number; // 0 - 100
}

export interface PerformancePattern {
  id: string;
  metricName: string;
  correlationCoefficient: number;
  description: string;
  detectedAt: Date;
}

export interface ImprovementRecommendation {
  id: string;
  type: RecommendationType;
  target: OptimizationTarget;
  description: string;
  estimatedImprovementPercent: number;
  confidence: ConfidenceScore;
  createdAt: Date;
  approved: boolean;
}

export interface LearningSample {
  id: string;
  inputFeatures: Record<string, any>;
  observedLabels: Record<string, any>;
  timestamp: Date;
}

export interface OptimizationDecision {
  id: string;
  recommendationId: string;
  target: OptimizationTarget;
  actionTaken: string;
  costSavedUsd: number;
  qualityDeltaPercent: number;
  timestamp: Date;
}

export interface ABVariant {
  id: string;
  name: string;
  config: Record<string, any>;
  viewsCount: number;
  conversionRate: number;
}

export interface ABTest {
  id: string;
  testName: string;
  variants: ABVariant[];
  winnerVariantId?: string;
  confidenceScore: number;
}

export interface Experiment {
  id: string;
  name: string;
  target: OptimizationTarget;
  state: ExperimentState;
  variants: string[];
  winnerVariant?: string;
  improvementPercent: number;
  durationDays: number;
  startedAt: Date;
  endedAt?: Date;
}

export interface FailureAnalysis {
  id: string;
  incidentId: string;
  failureReason: string;
  rollbackAction: string;
  timestamp: Date;
}

export interface HookPerformance {
  hookText: string;
  retentionThreeSecondsPercent: number;
  dropOffRatePercent: number;
}

export interface TitlePerformance {
  titleText: string;
  ctrPercent: number;
  impressionsCount: number;
}

export interface ThumbnailPerformance {
  styleName: string;
  ctrPercent: number;
  impressionsCount: number;
}

export interface PublishingWindow {
  dayOfWeek: number;
  hourOfDay: number;
  averageViews: number;
  averageEngagementRate: number;
}

export interface AudiencePattern {
  demographics: string;
  retentionCurveIndex: number;
  watchTimeMinutes: number;
}

export interface ScriptPattern {
  pacingWordsPerMinute: number;
  visualCutIntervalSeconds: number;
  retentionScore: number;
}

export interface RetentionPattern {
  stage: string;
  audienceDropPercent: number;
  relevanceScore: number;
}

export interface TopicCluster {
  topicName: string;
  category: string;
  growthVelocity: number;
}

export interface ProviderPerformance {
  providerId: string;
  averageLatencyMs: number;
  successRatePercent: number;
  costPerRequestUsd: number;
}

export interface ExecutionComparison {
  projectAId: string;
  projectBId: string;
  comparisonMetric: string;
  differencePercent: number;
}

export interface BudgetOptimization {
  targetBudgetUsd: number;
  allocatedBudgetUsd: number;
  estimatedSavingUsd: number;
}

export interface QualityOptimization {
  qualityTarget: string;
  currentQualityScore: number;
  optimizedQualityScore: number;
}

export interface LearningDataset {
  id: string;
  samples: LearningSample[];
  updatedAt: Date;
  size: number;
}

export interface AutonomousAction {
  id: string;
  actionType: string;
  description: string;
  targetId: string;
  executedAt: Date;
}

export interface OptimizationMetric {
  name: string;
  value: number;
  unit: string;
}

export interface FeedbackLoop {
  loopId: string;
  sourceEngine: string;
  destEngine: string;
  active: boolean;
  lastSyncTime: Date;
}

export interface LearningCheckpoint {
  checkpointId: string;
  weightsHash: string;
  lossValue: number;
  savedAt: Date;
}

export interface ImprovementHistory {
  id: string;
  type: string;
  target: OptimizationTarget;
  improvementPercent: number;
  dateApplied: Date;
}

export interface OptimizationReport {
  reportId: string;
  target: OptimizationTarget;
  recommendationsCount: number;
  averageImprovementPercent: number;
  timestamp: Date;
}

export interface ImprovementSnapshot {
  snapshotId: string;
  state: ImprovementState;
  activeExperimentsCount: number;
  recommendationsCount: number;
  timestamp: Date;
}

export interface ImprovementStatistics {
  optimizationPercent: number;
  averageImprovement: number;
  successRate: number;
  recommendationCount: number;
  learningSamples: number;
  experiments: number;
  winningRatio: number;
  roiImprovement: number;
  costSaved: number;
}

export interface ImprovementValidationIssue {
  field: string;
  message: string;
  severity: "WARNING" | "CRITICAL";
}

export interface ImprovementValidationReport {
  valid: boolean;
  issues: ImprovementValidationIssue[];
  timestamp: Date;
}
