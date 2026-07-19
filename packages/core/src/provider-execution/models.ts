import { ExecutionState } from "./ExecutionState";
import { ExecutionMode } from "./ExecutionMode";
import { SelectionStrategy } from "./SelectionStrategy";
import { CacheType } from "./CacheType";
import { BudgetAlert } from "./BudgetAlert";
import { QualityMetric } from "./QualityMetric";

// 1. ExecutionConfiguration
export interface ExecutionConfiguration {
  environment: string;
  defaultStrategy: SelectionStrategy;
  defaultMode: ExecutionMode;
  dailyBudgetUsd: number;
  monthlyBudgetUsd: number;
  founderPreferredProviders: string[];
  enableSmartCache: boolean;
  enableQualityEvaluation: boolean;
  enableBudgetProtection: boolean;
  cacheMaxSizeMb: number;
  cacheTtlSeconds: number;
  emergencyStopThresholdUsd: number;
  maxParallelRequests: number;
}

// 2. ExecutionRequest
export interface ExecutionRequest {
  requestId: string;
  prompt: string;
  model?: string;
  providerId?: string;
  mode: ExecutionMode;
  strategy: SelectionStrategy;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  requireApproval?: boolean;
  metadata?: Record<string, any>;
}

// 3. ExecutionResponse
export interface ExecutionResponse {
  requestId: string;
  providerId: string;
  model: string;
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs: number;
  cacheHit: boolean;
  qualityScore?: number;
  finishReason: string;
}

// 4. ExecutionBatch
export interface ExecutionBatch {
  batchId: string;
  requests: ExecutionRequest[];
  createdAt: Date;
  completedAt?: Date;
  totalCostUsd: number;
  successCount: number;
  failureCount: number;
}

// 5. ProviderScore
export interface ProviderScore {
  providerId: string;
  costScore: number;      // 0-100, higher = cheaper
  speedScore: number;     // 0-100, higher = faster
  qualityScore: number;   // 0-100, higher = better quality
  availabilityScore: number; // 0-100, higher = more available
  compositeScore: number; // weighted aggregate
}

// 6. ProviderSelectionResult
export interface ProviderSelectionResult {
  selectedProviderId: string;
  selectedModel: string;
  strategy: SelectionStrategy;
  scores: ProviderScore[];
  estimatedCostUsd: number;
  estimatedLatencyMs: number;
  reason: string;
}

// 7. CostEstimate
export interface CostEstimate {
  requestId: string;
  providerId: string;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
  pricePerPromptToken: number;
  pricePerCompletionToken: number;
  currency: string;
}

// 8. TokenEstimate
export interface TokenEstimate {
  requestId: string;
  promptText: string;
  estimatedPromptTokens: number;
  estimatedCompletionTokens: number;
  estimatedTotalTokens: number;
  confidencePercent: number;
}

// 9. BudgetStatus
export interface BudgetStatus {
  dailySpentUsd: number;
  dailyLimitUsd: number;
  dailyRemainingUsd: number;
  monthlySpentUsd: number;
  monthlyLimitUsd: number;
  monthlyRemainingUsd: number;
  alertLevel: BudgetAlert;
  emergencyStopActive: boolean;
  lastUpdated: Date;
}

// 10. CacheEntry
export interface CacheEntry {
  key: string;
  type: CacheType;
  value: any;
  createdAt: Date;
  expiresAt: Date;
  hitCount: number;
  sizeBytes: number;
}

// 11. CacheStats
export interface CacheStats {
  totalEntries: number;
  totalSizeBytes: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  evictionCount: number;
  lastWarmedAt?: Date;
}

// 12. LatencyRecord
export interface LatencyRecord {
  providerId: string;
  timestamp: Date;
  latencyMs: number;
  requestId: string;
  model: string;
}

// 13. ProviderBenchmark
export interface ProviderBenchmark {
  providerId: string;
  averageLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  successRate: number;
  throughputRpm: number;
  lastBenchmarkedAt: Date;
}

// 14. QualityScore
export interface QualityScore {
  requestId: string;
  providerId: string;
  overallScore: number;   // 0-100
  metrics: Record<QualityMetric, number>;
  confidence: number;     // 0-1
  evaluatedAt: Date;
}

// 15. RankedResponse
export interface RankedResponse {
  rank: number;
  response: ExecutionResponse;
  qualityScore: QualityScore;
  selected: boolean;
}

// 16. ExecutionRecord
export interface ExecutionRecord {
  requestId: string;
  mode: ExecutionMode;
  strategy: SelectionStrategy;
  providerId: string;
  startedAt: Date;
  completedAt?: Date;
  durationMs: number;
  costUsd: number;
  cacheHit: boolean;
  success: boolean;
  error?: string;
}

// 17. ExecutionSnapshot
export interface ExecutionSnapshot {
  state: ExecutionState;
  configuration: ExecutionConfiguration;
  timestamp: Date;
}

// 18. BudgetProtectionRule
export interface BudgetProtectionRule {
  ruleId: string;
  name: string;
  maxCostPerRequestUsd: number;
  requireApprovalAboveUsd: number;
  enabled: boolean;
}

// 19. CostPrediction
export interface CostPrediction {
  periodDays: number;
  predictedDailyCostUsd: number;
  predictedMonthlyCostUsd: number;
  basedOnRequests: number;
  confidencePercent: number;
  generatedAt: Date;
}

// 20. ExecutionReport
export interface ExecutionReport {
  generatedAt: Date;
  totalRequests: number;
  totalCostUsd: number;
  averageLatencyMs: number;
  cacheHitRate: number;
  averageQualityScore: number;
  budgetStatus: BudgetStatus;
  topProviders: ProviderBenchmark[];
  costPrediction: CostPrediction;
}
