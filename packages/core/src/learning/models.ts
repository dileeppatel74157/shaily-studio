import { LearningState }              from "./LearningState";
import { LearningSource }             from "./LearningSource";
import { LearningType }               from "./LearningType";
import { PatternConfidence }          from "./PatternConfidence";
import { RecommendationPriority }     from "./RecommendationPriority";
import { KnowledgeType }              from "./KnowledgeType";
import { ImprovementTarget }          from "./ImprovementTarget";

// ─── Core Models ──────────────────────────────────────────────────────────────

export interface LearningRequest {
  id: string;
  projectId?: string;
  source: LearningSource;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface LearningResponse {
  id: string;
  requestId: string;
  state: LearningState;
  patterns: LearningPattern[];
  recommendations: Recommendation[];
  updatedKnowledgeEntries: string[];
  timestamp: Date;
}

export interface LearningSession {
  id: string;
  state: LearningState;
  historyCollected: number;
  patternsDetected: number;
  recommendationsGenerated: number;
  knowledgeUpdated: number;
  startedAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface LearningPattern {
  id: string;
  type: LearningType;
  name: string;
  description: string;
  confidence: PatternConfidence;
  supportCount: number;      // number of executions supporting this pattern
  lastObservedAt: Date;
  features: Record<string, unknown>;
}

export interface SuccessPattern extends LearningPattern {
  type: LearningType.SUCCESS_PATTERN;
  overallScore: number;
  ctrPercent: number;
  retentionPercent: number;
}

export interface FailurePattern extends LearningPattern {
  type: LearningType.FAILURE_PATTERN;
  failureReason: string;
  stageName: string;
}

export interface WorkflowPattern extends LearningPattern {
  type: LearningType.WORKFLOW_PATTERN;
  sequence: string[];
  avgDurationMs: number;
}

export interface PromptPattern extends LearningPattern {
  type: LearningType.PROMPT_PATTERN;
  systemPromptHash: string;
  improvementSuggestion: string;
}

export interface DecisionPattern extends LearningPattern {
  type: LearningType.DECISION_PATTERN;
  choiceMade: string;
  outcomeMetric: string;
}

export interface ProviderPattern extends LearningPattern {
  type: LearningType.PROVIDER_PATTERN;
  providerName: string;
  latencyMs: number;
  costUsd: number;
}

export interface QualityPattern extends LearningPattern {
  type: LearningType.QUALITY_PATTERN;
  ruleViolated?: string;
  scoreGained: number;
}

export interface KnowledgeEntry {
  id: string;
  type: KnowledgeType;
  target: ImprovementTarget;
  title: string;
  description: string;
  ruleDefinition?: string;
  confidence: PatternConfidence;
  updatedAt: Date;
  dependencies: string[]; // knowledge IDs depended upon
}

export interface KnowledgeGraph {
  entries: KnowledgeEntry[];
  relations: Array<{ fromId: string; toId: string; relationType: string }>;
  version: number;
  lastUpdated: Date;
}

export interface Recommendation {
  id: string;
  priority: RecommendationPriority;
  target: ImprovementTarget;
  title: string;
  description: string;
  expectedImpactPercent: number;
  actionCode: string;
  parameters: Record<string, unknown>;
  createdAt: Date;
  applied: boolean;
  appliedAt?: Date;
}

export interface LearningInsight {
  id: string;
  title: string;
  description: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  source: LearningSource;
  timestamp: Date;
}

export interface ImprovementPlan {
  id: string;
  target: ImprovementTarget;
  recommendations: Recommendation[];
  owner: string;
  approved: boolean;
  createdAt: Date;
}

export interface LearningMetrics {
  totalHistoryProcessed: number;
  successfulExecutions: number;
  failedExecutions: number;
  patternsExtracted: number;
  insightsGenerated: number;
  averageAccuracy: number;
}

export interface LearningStatistics {
  accuracyBySource: Record<string, number>;
  totalLearningCycles: number;
  successRatio: number;
}

export interface LearningReport {
  id: string;
  metrics: LearningMetrics;
  statistics: LearningStatistics;
  recentPatterns: LearningPattern[];
  recentRecommendations: Recommendation[];
  generatedAt: Date;
}

export interface LearningSnapshot {
  id: string;
  state: LearningState;
  knowledgeEntries: KnowledgeEntry[];
  patterns: LearningPattern[];
  sessionStats: LearningStatistics;
  timestamp: Date;
}

export interface PatternCluster {
  id: string;
  clusterLabel: string;
  patterns: LearningPattern[];
  centroid: Record<string, unknown>;
}

export interface TrainingDataset {
  id: string;
  source: LearningSource;
  features: Array<Record<string, unknown>>;
  labels: string[];
  timestamp: Date;
}

export interface LearningHistory {
  id: string;
  projectId: string;
  source: LearningSource;
  success: boolean;
  durationMs: number;
  costUsd: number;
  metrics: Record<string, number>;
  timestamp: Date;
}

export interface LearningMemory {
  id: string;
  namespace: string;
  key: string;
  value: Record<string, unknown>;
  updatedAt: Date;
}
