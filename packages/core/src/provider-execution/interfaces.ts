import { ExecutionState } from "./ExecutionState";
import { ExecutionMode } from "./ExecutionMode";
import { SelectionStrategy } from "./SelectionStrategy";
import { CacheType } from "./CacheType";
import { BudgetAlert } from "./BudgetAlert";
import { QualityMetric } from "./QualityMetric";
import {
  ExecutionRequest,
  ExecutionResponse,
  ExecutionBatch,
  ProviderScore,
  ProviderSelectionResult,
  CostEstimate,
  TokenEstimate,
  BudgetStatus,
  CacheEntry,
  CacheStats,
  LatencyRecord,
  ProviderBenchmark,
  QualityScore,
  RankedResponse,
  ExecutionRecord,
  ExecutionSnapshot,
  BudgetProtectionRule,
  CostPrediction,
  ExecutionReport
} from "./models";

// Sub-manager interfaces

export interface IExecutionManager {
  execute(request: ExecutionRequest): Promise<ExecutionResponse>;
  executeBatch(batch: ExecutionBatch): Promise<ExecutionResponse[]>;
  executeParallel(requests: ExecutionRequest[]): Promise<ExecutionResponse[]>;
  executeSequential(requests: ExecutionRequest[]): Promise<ExecutionResponse[]>;
  stream(request: ExecutionRequest): AsyncGenerator<string>;
  getHistory(): ExecutionRecord[];
  clearHistory(): void;
}

export interface IProviderSelector {
  selectBest(request: ExecutionRequest): ProviderSelectionResult;
  scoreProviders(request: ExecutionRequest): ProviderScore[];
  applyFounderRules(scores: ProviderScore[]): ProviderScore[];
  applyFallback(failedProviderId: string): string | undefined;
  checkAvailability(providerId: string): boolean;
}

export interface ICostOptimizer {
  estimateTokens(prompt: string, model?: string): TokenEstimate;
  estimateCost(requestId: string, prompt: string, providerId: string, model?: string): CostEstimate;
  selectCheapest(candidates: ProviderScore[]): string;
  balanceQualityVsCost(scores: ProviderScore[], qualityWeight: number): string;
  predictCost(days: number): CostPrediction;
  getDailySpending(): number;
  getMonthlySpending(): number;
}

export interface IPerformanceOptimizer {
  recordLatency(record: LatencyRecord): void;
  getProviderBenchmark(providerId: string): ProviderBenchmark;
  optimizeQueue(requests: ExecutionRequest[]): ExecutionRequest[];
  getOptimalParallelism(requestCount: number): number;
  trackThroughput(providerId: string, requestsPerMinute: number): void;
}

export interface ISmartCache {
  get(key: string, type: CacheType): CacheEntry | undefined;
  set(key: string, type: CacheType, value: any, ttlSeconds?: number): CacheEntry;
  invalidate(key: string): boolean;
  invalidateByType(type: CacheType): number;
  getStats(): CacheStats;
  warm(entries: Array<{ key: string; type: CacheType; value: any }>): void;
  buildCacheKey(prompt: string, providerId: string, model: string): string;
}

export interface IQualityEvaluator {
  score(response: ExecutionResponse): QualityScore;
  compareResponses(responses: ExecutionResponse[]): RankedResponse[];
  selectBestResponse(ranked: RankedResponse[]): ExecutionResponse;
  shouldRegenerate(score: QualityScore, threshold: number): boolean;
  getConfidence(response: ExecutionResponse): number;
}

export interface IBudgetProtector {
  checkBudget(estimatedCostUsd: number): BudgetAlert;
  recordSpending(costUsd: number, requestId: string): void;
  getBudgetStatus(): BudgetStatus;
  triggerEmergencyStop(reason: string): void;
  resetEmergencyStop(): void;
  isEmergencyStopActive(): boolean;
  requiresFounderApproval(costUsd: number): boolean;
  addRule(rule: BudgetProtectionRule): void;
}

export interface IExecutionMonitor {
  startTracking(requestId: string, mode: ExecutionMode, strategy: SelectionStrategy): void;
  completeTracking(requestId: string, response: ExecutionResponse): void;
  failTracking(requestId: string, error: string): void;
  getExecutionHistory(): ExecutionRecord[];
  getActiveRequests(): string[];
}

export interface IExecutionValidator {
  validate(snapshot: ExecutionSnapshot): void;
}

export interface IExecutionReporter {
  generateReport(): Promise<ExecutionReport>;
}

// Master engine interface
export interface IProviderExecutionEngine {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;

  getState(): ExecutionState;
  getSnapshot(): ExecutionSnapshot;

  execute(request: ExecutionRequest): Promise<ExecutionResponse>;
  executeBatch(batch: ExecutionBatch): Promise<ExecutionResponse[]>;
  stream(request: ExecutionRequest): AsyncGenerator<string>;

  getExecutionManager(): IExecutionManager;
  getProviderSelector(): IProviderSelector;
  getCostOptimizer(): ICostOptimizer;
  getPerformanceOptimizer(): IPerformanceOptimizer;
  getSmartCache(): ISmartCache;
  getQualityEvaluator(): IQualityEvaluator;
  getBudgetProtector(): IBudgetProtector;
  getMonitor(): IExecutionMonitor;
  getValidator(): IExecutionValidator;
  getReporter(): IExecutionReporter;
}
