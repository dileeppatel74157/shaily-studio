import { OptimizationState }     from "./OptimizationState";
import { OptimizationTarget }    from "./OptimizationTarget";
import { OptimizationStrategy }  from "./OptimizationStrategy";
import { OptimizationPriority }  from "./OptimizationPriority";
import { OptimizationStatus }    from "./OptimizationStatus";
import { OptimizationSource }    from "./OptimizationSource";
import { OptimizationResult }    from "./OptimizationResult";

// ─── Optimization Data Models ─────────────────────────────────────────────────

export interface OptimizationRequest {
  id: string;
  source: OptimizationSource;
  strategy: OptimizationStrategy;
  targets: OptimizationTarget[];
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface OptimizationResponse {
  id: string;
  requestId: string;
  state: OptimizationState;
  appliedCount: number;
  results: OptimizationResult[];
  timestamp: Date;
}

export interface OptimizationJob {
  id: string;
  state: OptimizationState;
  target: OptimizationTarget;
  strategy: OptimizationStrategy;
  startedAt: Date;
  completedAt?: Date;
}

export interface OptimizationRule {
  id: string;
  name: string;
  target: OptimizationTarget;
  priority: OptimizationPriority;
  condition: string;          // condition check string/logic
  parameterConfig: Record<string, unknown>;
  active: boolean;
  dependencies: string[];    // rule IDs depended on
}

export interface OptimizationCandidate {
  id: string;
  target: OptimizationTarget;
  strategy: OptimizationStrategy;
  priority: OptimizationPriority;
  currentValue: Record<string, unknown>;
  proposedValue: Record<string, unknown>;
  expectedImprovementPercent: number;
  confidenceScore: number;   // 0–1
  rank?: number;
}

export interface OptimizationRecommendation {
  id: string;
  candidateId: string;
  target: OptimizationTarget;
  recommendationText: string;
  impactMetrics: string[];
}

export interface OptimizationExecution {
  id: string;
  candidateId: string;
  target: OptimizationTarget;
  status: OptimizationStatus;
  appliedAt: Date;
  rollbackPath?: string;
  measuredImpact?: OptimizationImpact;
}

export interface OptimizationHistory {
  id: string;
  executions: OptimizationExecution[];
  totalApplied: number;
  totalRolledBack: number;
}

export interface OptimizationMetrics {
  accuracy: number;           // 0–1
  averageSpeedupPercent: number;
  totalCostSavedUsd: number;
  successRate: number;        // 0–1
}

export interface OptimizationImpact {
  id: string;
  executionId: string;
  result: OptimizationResult;
  metricDiffPercent: number;  // improvement percentage
  costDiffUsd: number;
  latencyDiffMs: number;
  measuredAt: Date;
}

export interface OptimizationReport {
  id: string;
  metrics: OptimizationMetrics;
  recentImpacts: OptimizationImpact[];
  generatedAt: Date;
}

export interface OptimizationSnapshot {
  id: string;
  state: OptimizationState;
  activeRules: OptimizationRule[];
  candidates: OptimizationCandidate[];
  executions: OptimizationExecution[];
  timestamp: Date;
}
