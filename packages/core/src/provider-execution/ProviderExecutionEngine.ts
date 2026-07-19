import { ExecutionState } from "./ExecutionState";
import { ExecutionMode } from "./ExecutionMode";
import { SelectionStrategy } from "./SelectionStrategy";
import { CacheType } from "./CacheType";
import { BudgetAlert } from "./BudgetAlert";
import { QualityMetric } from "./QualityMetric";
import { ExecutionEventType } from "./ExecutionEventType";
import {
  IProviderExecutionEngine,
  IExecutionManager,
  IProviderSelector,
  ICostOptimizer,
  IPerformanceOptimizer,
  ISmartCache,
  IQualityEvaluator,
  IBudgetProtector,
  IExecutionMonitor,
  IExecutionValidator,
  IExecutionReporter
} from "./interfaces";
import {
  ExecutionConfiguration,
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
import { ExecutionValidator } from "./ExecutionValidator";
import {
  InvalidExecutionStateException,
  BudgetExceededException,
  EmergencyStopException,
  deepFreeze
} from "./types";

// Provider pricing table (USD per 1K tokens) — approximate
const PROVIDER_PRICING: Record<string, { prompt: number; completion: number; latencyMs: number; qualityScore: number }> = {
  openai:      { prompt: 0.005,   completion: 0.015,   latencyMs: 800,  qualityScore: 92 },
  gemini:      { prompt: 0.00125, completion: 0.005,   latencyMs: 600,  qualityScore: 88 },
  openrouter:  { prompt: 0.003,   completion: 0.009,   latencyMs: 900,  qualityScore: 85 },
  huggingface: { prompt: 0.0004,  completion: 0.0008,  latencyMs: 1200, qualityScore: 72 },
  ollama:      { prompt: 0.0,     completion: 0.0,     latencyMs: 400,  qualityScore: 75 },
  tavily:      { prompt: 0.001,   completion: 0.001,   latencyMs: 500,  qualityScore: 80 },
  youtube:     { prompt: 0.0,     completion: 0.0,     latencyMs: 300,  qualityScore: 70 },
  instagram:   { prompt: 0.0,     completion: 0.0,     latencyMs: 350,  qualityScore: 68 },
  facebook:    { prompt: 0.0,     completion: 0.0,     latencyMs: 350,  qualityScore: 68 }
};

const DEFAULT_PROVIDERS = Object.keys(PROVIDER_PRICING);

export class ProviderExecutionEngine implements
  IProviderExecutionEngine,
  IExecutionManager,
  IProviderSelector,
  ICostOptimizer,
  IPerformanceOptimizer,
  ISmartCache,
  IQualityEvaluator,
  IBudgetProtector,
  IExecutionMonitor,
  IExecutionValidator,
  IExecutionReporter
{
  private _state: ExecutionState = ExecutionState.CREATED;
  private readonly _config: ExecutionConfiguration;
  private readonly _context: any;
  private readonly _gateway: any; // IGatewayEngine reference (optional)
  private readonly _validator = new ExecutionValidator();

  // Execution tracking
  private readonly _history: ExecutionRecord[] = [];
  private readonly _activeRequests = new Set<string>();

  // Cache
  private readonly _cache = new Map<string, CacheEntry>();
  private _cacheHits = 0;
  private _cacheMisses = 0;
  private _cacheEvictions = 0;
  private _cacheLastWarmedAt?: Date;

  // Budget
  private _dailySpentUsd = 0;
  private _monthlySpentUsd = 0;
  private _emergencyStopActive = false;
  private _emergencyStopReason = "";
  private readonly _budgetRules: BudgetProtectionRule[] = [];

  // Performance
  private readonly _latencyRecords: LatencyRecord[] = [];
  private readonly _benchmarks = new Map<string, ProviderBenchmark>();

  // Quality
  private readonly _qualityScores: QualityScore[] = [];

  // Request counter (for round-robin)
  private _rrCursor = 0;
  private _startedAt: Date = new Date();

  constructor(context: any, config: ExecutionConfiguration, gateway?: any) {
    this._context = context;
    this._config  = config;
    this._gateway = gateway;
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================
  private transitionState(next: ExecutionState): void {
    const valid: Record<ExecutionState, ExecutionState[]> = {
      [ExecutionState.CREATED]:      [ExecutionState.INITIALIZING],
      [ExecutionState.INITIALIZING]: [ExecutionState.RUNNING, ExecutionState.ERROR],
      [ExecutionState.RUNNING]:      [ExecutionState.STOPPING, ExecutionState.ERROR],
      [ExecutionState.STOPPING]:     [ExecutionState.STOPPED],
      [ExecutionState.STOPPED]:      [ExecutionState.INITIALIZING],
      [ExecutionState.ERROR]:        [ExecutionState.INITIALIZING]
    };
    if (!valid[this._state].includes(next)) {
      throw new InvalidExecutionStateException(`transition to ${next}`, this._state);
    }
    this._state = next;
  }

  async initialize(): Promise<void> {
    this.transitionState(ExecutionState.INITIALIZING);
    this._validator.validate(this.getSnapshot());
    this._initBenchmarks();
    this._startedAt = new Date();
    this.transitionState(ExecutionState.RUNNING);
    await this._context.eventBus?.publish({ type: ExecutionEventType.REQUEST_STARTED, payload: { status: "initialized" } });
  }

  async start(): Promise<void> {
    if (this._state !== ExecutionState.RUNNING) await this.initialize();
  }

  async stop(): Promise<void> {
    this.transitionState(ExecutionState.STOPPING);
    this._activeRequests.clear();
    this.transitionState(ExecutionState.STOPPED);
  }

  getState(): ExecutionState { return this._state; }

  getSnapshot(): ExecutionSnapshot {
    return deepFreeze<ExecutionSnapshot>({
      state: this._state,
      configuration: JSON.parse(JSON.stringify(this._config)),
      timestamp: new Date()
    });
  }

  // ===========================================================================
  // IProviderExecutionEngine — main pipeline
  // ===========================================================================
  async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    this._validator.validateRequest(request.requestId, request.prompt);

    // Emergency stop check
    if (this._emergencyStopActive) {
      throw new EmergencyStopException(this._emergencyStopReason);
    }

    // Cache check
    const cacheKey = this.buildCacheKey(request.prompt, request.providerId ?? "auto", request.model ?? "default");
    if (this._config.enableSmartCache) {
      const cached = this.get(cacheKey, CacheType.RESPONSE);
      if (cached) {
        await this._context.eventBus?.publish({ type: ExecutionEventType.CACHE_HIT, payload: { requestId: request.requestId } });
        return { ...(cached.value as ExecutionResponse), requestId: request.requestId, cacheHit: true };
      }
      await this._context.eventBus?.publish({ type: ExecutionEventType.CACHE_MISS, payload: { requestId: request.requestId } });
    }

    // Provider selection
    const selection = this.selectBest(request);
    await this._context.eventBus?.publish({ type: ExecutionEventType.PROVIDER_SELECTED, payload: selection });

    // Budget check
    const costEstimate = this.estimateCost(request.requestId, request.prompt, selection.selectedProviderId, selection.selectedModel);
    if (this._config.enableBudgetProtection) {
      const alert = this.checkBudget(costEstimate.estimatedCostUsd);
      if (alert === BudgetAlert.EMERGENCY_STOP) {
        throw new BudgetExceededException(request.requestId, costEstimate.estimatedCostUsd, this._config.emergencyStopThresholdUsd);
      }
    }

    this.startTracking(request.requestId, request.mode, request.strategy);

    const start = Date.now();
    const response = await this._simulateExecution(request, selection.selectedProviderId, selection.selectedModel);
    const latencyMs = Date.now() - start;

    this._validator.validateLatency(latencyMs, request.requestId);
    this.recordLatency({ providerId: selection.selectedProviderId, timestamp: new Date(), latencyMs, requestId: request.requestId, model: selection.selectedModel });

    // Quality evaluation
    let qualityScore: number | undefined;
    if (this._config.enableQualityEvaluation) {
      const qs = this.score(response);
      qualityScore = qs.overallScore;
      await this._context.eventBus?.publish({ type: ExecutionEventType.QUALITY_SCORED, payload: qs });
    }

    const finalResponse: ExecutionResponse = { ...response, latencyMs, cacheHit: false, qualityScore };

    // Cache the result
    if (this._config.enableSmartCache) {
      this.set(cacheKey, CacheType.RESPONSE, finalResponse, this._config.cacheTtlSeconds);
    }

    // Budget tracking
    if (this._config.enableBudgetProtection) {
      this.recordSpending(finalResponse.costUsd, request.requestId);
    }

    this.completeTracking(request.requestId, finalResponse);
    await this._context.eventBus?.publish({ type: ExecutionEventType.REQUEST_COMPLETED, payload: finalResponse });

    return finalResponse;
  }

  async executeBatch(batch: ExecutionBatch): Promise<ExecutionResponse[]> {
    this._validator.validateBatchSize(batch.requests.length);
    const results: ExecutionResponse[] = [];
    for (const req of batch.requests) {
      try {
        results.push(await this.execute(req));
        batch.successCount++;
      } catch (err) {
        batch.failureCount++;
        results.push({ requestId: req.requestId, providerId: "error", model: "none", content: `[ERROR] ${String(err)}`, promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0, latencyMs: 0, cacheHit: false, finishReason: "error" });
      }
    }
    batch.completedAt = new Date();
    return results;
  }

  async *stream(request: ExecutionRequest): AsyncGenerator<string> {
    this._validator.validateRequest(request.requestId, request.prompt);
    const words = `[STREAM ${request.requestId}] Response: ${request.prompt}`.split(" ");
    for (const word of words) {
      yield word + " ";
      await new Promise(r => setTimeout(r, 5));
    }
  }

  // ===========================================================================
  // IExecutionManager
  // ===========================================================================
  async executeParallel(requests: ExecutionRequest[]): Promise<ExecutionResponse[]> {
    const limited = requests.slice(0, this._config.maxParallelRequests);
    return Promise.all(limited.map(r => this.execute(r)));
  }

  async executeSequential(requests: ExecutionRequest[]): Promise<ExecutionResponse[]> {
    const results: ExecutionResponse[] = [];
    for (const r of requests) {
      results.push(await this.execute(r));
    }
    return results;
  }

  getHistory(): ExecutionRecord[] { return [...this._history]; }
  clearHistory(): void { this._history.length = 0; }

  // ===========================================================================
  // IProviderSelector
  // ===========================================================================
  selectBest(request: ExecutionRequest): ProviderSelectionResult {
    let scores = this.scoreProviders(request);

    // Apply founder rules if strategy is FOUNDER_PREFERRED
    if (request.strategy === SelectionStrategy.FOUNDER_PREFERRED) {
      scores = this.applyFounderRules(scores);
    }

    const strategy = request.strategy;
    let selected: ProviderScore;

    if (strategy === SelectionStrategy.COST_OPTIMIZED) {
      selected = scores.reduce((a, b) => a.costScore > b.costScore ? a : b);
    } else if (strategy === SelectionStrategy.SPEED_OPTIMIZED) {
      selected = scores.reduce((a, b) => a.speedScore > b.speedScore ? a : b);
    } else if (strategy === SelectionStrategy.QUALITY_OPTIMIZED) {
      selected = scores.reduce((a, b) => a.qualityScore > b.qualityScore ? a : b);
    } else if (strategy === SelectionStrategy.AVAILABILITY_FIRST) {
      selected = scores.reduce((a, b) => a.availabilityScore > b.availabilityScore ? a : b);
    } else {
      // BALANCED / FOUNDER_PREFERRED — use composite score
      selected = scores.reduce((a, b) => a.compositeScore > b.compositeScore ? a : b);
    }

    // If request specifies a provider explicitly, use it
    if (request.providerId && DEFAULT_PROVIDERS.includes(request.providerId)) {
      const explicit = scores.find(s => s.providerId === request.providerId);
      if (explicit) selected = explicit;
    }

    const pricing = PROVIDER_PRICING[selected.providerId];
    const tokenEst = this.estimateTokens(request.prompt);
    const estimatedCost = this.estimateCost(request.requestId, request.prompt, selected.providerId).estimatedCostUsd;

    return {
      selectedProviderId: selected.providerId,
      selectedModel: request.model ?? this._defaultModel(selected.providerId),
      strategy,
      scores,
      estimatedCostUsd: estimatedCost,
      estimatedLatencyMs: pricing?.latencyMs ?? 800,
      reason: `Selected by ${strategy} strategy (composite: ${selected.compositeScore.toFixed(1)})`
    };
  }

  scoreProviders(request: ExecutionRequest): ProviderScore[] {
    return DEFAULT_PROVIDERS.map(pid => {
      const p = PROVIDER_PRICING[pid];
      const costScore      = Math.max(0, 100 - (p.prompt * 1000 + p.completion * 1000) * 5);
      const speedScore     = Math.max(0, 100 - p.latencyMs / 20);
      const qualityScore   = p.qualityScore;
      const availScore     = 90; // Simulated
      const compositeScore = (costScore * 0.25 + speedScore * 0.25 + qualityScore * 0.35 + availScore * 0.15);

      this._validator.validateProviderScore(Math.min(100, compositeScore), pid);

      return { providerId: pid, costScore, speedScore, qualityScore, availabilityScore: availScore, compositeScore: Math.min(100, compositeScore) };
    });
  }

  applyFounderRules(scores: ProviderScore[]): ProviderScore[] {
    return scores.map(s => {
      if (this._config.founderPreferredProviders.includes(s.providerId)) {
        return { ...s, compositeScore: Math.min(100, s.compositeScore + 10) };
      }
      return s;
    });
  }

  applyFallback(failedProviderId: string): string | undefined {
    return DEFAULT_PROVIDERS.find(pid => pid !== failedProviderId);
  }

  checkAvailability(providerId: string): boolean {
    return DEFAULT_PROVIDERS.includes(providerId);
  }

  // ===========================================================================
  // ICostOptimizer
  // ===========================================================================
  estimateTokens(prompt: string, _model?: string): TokenEstimate {
    const estimated = Math.ceil(prompt.length / 4);
    const completion = Math.floor(estimated * 0.6);
    this._validator.validateTokenEstimate(estimated);
    return {
      requestId: `est-${Date.now()}`,
      promptText: prompt.slice(0, 100),
      estimatedPromptTokens: estimated,
      estimatedCompletionTokens: completion,
      estimatedTotalTokens: estimated + completion,
      confidencePercent: 85
    };
  }

  estimateCost(requestId: string, prompt: string, providerId: string, _model?: string): CostEstimate {
    const pricing = PROVIDER_PRICING[providerId] ?? PROVIDER_PRICING["openai"];
    const tokens  = this.estimateTokens(prompt);
    const cost = (tokens.estimatedPromptTokens / 1000) * pricing.prompt +
                 (tokens.estimatedCompletionTokens / 1000) * pricing.completion;

    this._validator.validateCostEstimate(cost, requestId);
    return {
      requestId,
      providerId,
      promptTokens: tokens.estimatedPromptTokens,
      completionTokens: tokens.estimatedCompletionTokens,
      estimatedCostUsd: cost,
      pricePerPromptToken: pricing.prompt / 1000,
      pricePerCompletionToken: pricing.completion / 1000,
      currency: "USD"
    };
  }

  selectCheapest(candidates: ProviderScore[]): string {
    return candidates.reduce((a, b) => a.costScore > b.costScore ? a : b).providerId;
  }

  balanceQualityVsCost(scores: ProviderScore[], qualityWeight: number): string {
    const costWeight = 1 - qualityWeight;
    const best = scores.reduce((a, b) => {
      const scoreA = a.qualityScore * qualityWeight + a.costScore * costWeight;
      const scoreB = b.qualityScore * qualityWeight + b.costScore * costWeight;
      return scoreA > scoreB ? a : b;
    });
    return best.providerId;
  }

  predictCost(days: number): CostPrediction {
    const recordCount = this._history.length;
    const totalCost   = this._history.reduce((sum, r) => sum + r.costUsd, 0);
    const avgDailyCost = recordCount > 0 ? (totalCost / Math.max(1, days)) : 0.5;
    return {
      periodDays: days,
      predictedDailyCostUsd: avgDailyCost,
      predictedMonthlyCostUsd: avgDailyCost * 30,
      basedOnRequests: recordCount,
      confidencePercent: Math.min(90, 50 + recordCount),
      generatedAt: new Date()
    };
  }

  getDailySpending(): number  { return this._dailySpentUsd; }
  getMonthlySpending(): number { return this._monthlySpentUsd; }

  // ===========================================================================
  // IPerformanceOptimizer
  // ===========================================================================
  recordLatency(record: LatencyRecord): void {
    this._latencyRecords.push(record);
    this._updateBenchmark(record.providerId);
  }

  getProviderBenchmark(providerId: string): ProviderBenchmark {
    return this._benchmarks.get(providerId) ?? {
      providerId,
      averageLatencyMs: PROVIDER_PRICING[providerId]?.latencyMs ?? 800,
      p50LatencyMs: PROVIDER_PRICING[providerId]?.latencyMs ?? 800,
      p95LatencyMs: (PROVIDER_PRICING[providerId]?.latencyMs ?? 800) * 1.5,
      successRate: 0.99,
      throughputRpm: 60,
      lastBenchmarkedAt: new Date()
    };
  }

  optimizeQueue(requests: ExecutionRequest[]): ExecutionRequest[] {
    // Sort by estimated cost ascending (cheapest first)
    return [...requests].sort((a, b) => {
      const ca = this.estimateCost(a.requestId, a.prompt, a.providerId ?? "ollama").estimatedCostUsd;
      const cb = this.estimateCost(b.requestId, b.prompt, b.providerId ?? "ollama").estimatedCostUsd;
      return ca - cb;
    });
  }

  getOptimalParallelism(requestCount: number): number {
    return Math.min(requestCount, this._config.maxParallelRequests);
  }

  trackThroughput(providerId: string, requestsPerMinute: number): void {
    const bench = this.getProviderBenchmark(providerId);
    this._benchmarks.set(providerId, { ...bench, throughputRpm: requestsPerMinute });
  }

  // ===========================================================================
  // ISmartCache
  // ===========================================================================
  get(key: string, type: CacheType): CacheEntry | undefined {
    this._validator.validateCacheKey(key);
    const entry = this._cache.get(`${type}:${key}`);
    if (!entry) { this._cacheMisses++; return undefined; }
    if (entry.expiresAt < new Date()) {
      this._cache.delete(`${type}:${key}`);
      this._cacheEvictions++;
      this._cacheMisses++;
      return undefined;
    }
    this._cacheHits++;
    entry.hitCount++;
    return entry;
  }

  set(key: string, type: CacheType, value: any, ttlSeconds: number = this._config.cacheTtlSeconds): CacheEntry {
    this._validator.validateCacheKey(key);
    this._validator.validateCacheTtl(ttlSeconds);
    const entry: CacheEntry = {
      key,
      type,
      value,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      hitCount: 0,
      sizeBytes: JSON.stringify(value).length
    };
    this._cache.set(`${type}:${key}`, entry);
    return entry;
  }

  invalidate(key: string): boolean {
    let removed = false;
    for (const type of Object.values(CacheType)) {
      if (this._cache.delete(`${type}:${key}`)) { removed = true; this._cacheEvictions++; }
    }
    return removed;
  }

  invalidateByType(type: CacheType): number {
    let count = 0;
    for (const k of this._cache.keys()) {
      if (k.startsWith(`${type}:`)) { this._cache.delete(k); count++; this._cacheEvictions++; }
    }
    return count;
  }

  getStats(): CacheStats {
    const total = this._cacheHits + this._cacheMisses;
    return {
      totalEntries: this._cache.size,
      totalSizeBytes: Array.from(this._cache.values()).reduce((s, e) => s + e.sizeBytes, 0),
      hitCount: this._cacheHits,
      missCount: this._cacheMisses,
      hitRate: total > 0 ? this._cacheHits / total : 0,
      evictionCount: this._cacheEvictions,
      lastWarmedAt: this._cacheLastWarmedAt
    };
  }

  warm(entries: Array<{ key: string; type: CacheType; value: any }>): void {
    for (const e of entries) {
      this.set(e.key, e.type, e.value, this._config.cacheTtlSeconds);
    }
    this._cacheLastWarmedAt = new Date();
  }

  buildCacheKey(prompt: string, providerId: string, model: string): string {
    const hash = Buffer.from(`${providerId}:${model}:${prompt}`).toString("base64").slice(0, 32);
    return hash;
  }

  // ===========================================================================
  // IQualityEvaluator
  // ===========================================================================
  score(response: ExecutionResponse): QualityScore {
    const base = PROVIDER_PRICING[response.providerId]?.qualityScore ?? 75;
    const len   = response.content.length;
    const bonus = Math.min(10, len / 50);
    const overall = Math.min(100, base + bonus);

    this._validator.validateQualityScore(overall);

    const metrics: Record<QualityMetric, number> = {
      [QualityMetric.RELEVANCE]:    Math.min(100, base + 2),
      [QualityMetric.COHERENCE]:    Math.min(100, base + 1),
      [QualityMetric.ACCURACY]:     Math.min(100, base - 1),
      [QualityMetric.COMPLETENESS]: Math.min(100, base + bonus),
      [QualityMetric.FLUENCY]:      Math.min(100, base + 3)
    };

    const qs: QualityScore = { requestId: response.requestId, providerId: response.providerId, overallScore: overall, metrics, confidence: 0.85, evaluatedAt: new Date() };
    this._qualityScores.push(qs);
    return qs;
  }

  compareResponses(responses: ExecutionResponse[]): RankedResponse[] {
    const scored = responses.map(r => ({ response: r, qualityScore: this.score(r) }));
    scored.sort((a, b) => b.qualityScore.overallScore - a.qualityScore.overallScore);
    return scored.map((s, i) => ({ rank: i + 1, response: s.response, qualityScore: s.qualityScore, selected: i === 0 }));
  }

  selectBestResponse(ranked: RankedResponse[]): ExecutionResponse {
    const best = ranked.find(r => r.selected) ?? ranked[0];
    return best.response;
  }

  shouldRegenerate(qs: QualityScore, threshold: number): boolean {
    return qs.overallScore < threshold;
  }

  getConfidence(response: ExecutionResponse): number {
    return 0.85 + (response.totalTokens > 100 ? 0.1 : 0);
  }

  // ===========================================================================
  // IBudgetProtector
  // ===========================================================================
  checkBudget(estimatedCostUsd: number): BudgetAlert {
    const dailyRemaining   = this._config.dailyBudgetUsd - this._dailySpentUsd;
    const monthlyRemaining = this._config.monthlyBudgetUsd - this._monthlySpentUsd;

    if (this._emergencyStopActive || estimatedCostUsd > this._config.emergencyStopThresholdUsd) {
      return BudgetAlert.EMERGENCY_STOP;
    }
    if (estimatedCostUsd > dailyRemaining || estimatedCostUsd > monthlyRemaining) {
      return BudgetAlert.CRITICAL;
    }
    const dailyUsedPercent = this._dailySpentUsd / this._config.dailyBudgetUsd;
    if (dailyUsedPercent > 0.9) return BudgetAlert.CRITICAL;
    if (dailyUsedPercent > 0.75) return BudgetAlert.WARNING;
    return BudgetAlert.INFO;
  }

  recordSpending(costUsd: number, requestId: string): void {
    this._validator.validateCostEstimate(costUsd, requestId);
    this._dailySpentUsd   += costUsd;
    this._monthlySpentUsd += costUsd;

    // Auto emergency stop
    if (this._monthlySpentUsd >= this._config.emergencyStopThresholdUsd) {
      this.triggerEmergencyStop(`Monthly spending $${this._monthlySpentUsd.toFixed(4)} reached emergency threshold.`);
    }
  }

  getBudgetStatus(): BudgetStatus {
    return {
      dailySpentUsd: this._dailySpentUsd,
      dailyLimitUsd: this._config.dailyBudgetUsd,
      dailyRemainingUsd: Math.max(0, this._config.dailyBudgetUsd - this._dailySpentUsd),
      monthlySpentUsd: this._monthlySpentUsd,
      monthlyLimitUsd: this._config.monthlyBudgetUsd,
      monthlyRemainingUsd: Math.max(0, this._config.monthlyBudgetUsd - this._monthlySpentUsd),
      alertLevel: this.checkBudget(0),
      emergencyStopActive: this._emergencyStopActive,
      lastUpdated: new Date()
    };
  }

  triggerEmergencyStop(reason: string): void {
    this._emergencyStopActive  = true;
    this._emergencyStopReason  = reason;
    this._context.eventBus?.publish({ type: ExecutionEventType.BUDGET_ALERT, payload: { level: BudgetAlert.EMERGENCY_STOP, reason } });
  }

  resetEmergencyStop(): void {
    this._emergencyStopActive = false;
    this._emergencyStopReason = "";
  }

  isEmergencyStopActive(): boolean { return this._emergencyStopActive; }

  requiresFounderApproval(costUsd: number): boolean {
    return this._budgetRules.some(r => r.enabled && costUsd >= r.requireApprovalAboveUsd);
  }

  addRule(rule: BudgetProtectionRule): void {
    this._validator.validateBudgetRule(rule.maxCostPerRequestUsd, rule.requireApprovalAboveUsd);
    this._budgetRules.push(rule);
  }

  // ===========================================================================
  // IExecutionMonitor
  // ===========================================================================
  startTracking(requestId: string, mode: ExecutionMode, strategy: SelectionStrategy): void {
    this._activeRequests.add(requestId);
    this._history.push({
      requestId, mode, strategy,
      providerId: "pending",
      startedAt: new Date(),
      durationMs: 0,
      costUsd: 0,
      cacheHit: false,
      success: false
    });
  }

  completeTracking(requestId: string, response: ExecutionResponse): void {
    this._activeRequests.delete(requestId);
    const record = this._history.find(r => r.requestId === requestId);
    if (record) {
      record.providerId   = response.providerId;
      record.completedAt  = new Date();
      record.durationMs   = response.latencyMs;
      record.costUsd      = response.costUsd;
      record.cacheHit     = response.cacheHit;
      record.success      = true;
    }
  }

  failTracking(requestId: string, error: string): void {
    this._activeRequests.delete(requestId);
    const record = this._history.find(r => r.requestId === requestId);
    if (record) {
      record.completedAt = new Date();
      record.success     = false;
      record.error       = error;
    }
  }

  getExecutionHistory(): ExecutionRecord[] { return [...this._history]; }
  getActiveRequests(): string[] { return [...this._activeRequests]; }

  // ===========================================================================
  // IExecutionValidator
  // ===========================================================================
  validate(snapshot: ExecutionSnapshot): void {
    this._validator.validate(snapshot);
  }

  // ===========================================================================
  // IExecutionReporter
  // ===========================================================================
  async generateReport(): Promise<ExecutionReport> {
    const total   = this._history.length;
    const totalCost = this._history.reduce((s, r) => s + r.costUsd, 0);
    const avgLatency = total > 0 ? this._history.reduce((s, r) => s + r.durationMs, 0) / total : 0;
    const hits      = this._history.filter(r => r.cacheHit).length;
    const avgQuality = this._qualityScores.length > 0
      ? this._qualityScores.reduce((s, q) => s + q.overallScore, 0) / this._qualityScores.length : 0;

    const topProviders = DEFAULT_PROVIDERS.slice(0, 3).map(pid => this.getProviderBenchmark(pid));

    return {
      generatedAt: new Date(),
      totalRequests: total,
      totalCostUsd: totalCost,
      averageLatencyMs: avgLatency,
      cacheHitRate: total > 0 ? hits / total : 0,
      averageQualityScore: avgQuality,
      budgetStatus: this.getBudgetStatus(),
      topProviders,
      costPrediction: this.predictCost(30)
    };
  }

  // ===========================================================================
  // Sub-manager delegation
  // ===========================================================================
  getExecutionManager(): IExecutionManager         { return this; }
  getProviderSelector(): IProviderSelector         { return this; }
  getCostOptimizer(): ICostOptimizer               { return this; }
  getPerformanceOptimizer(): IPerformanceOptimizer { return this; }
  getSmartCache(): ISmartCache                     { return this; }
  getQualityEvaluator(): IQualityEvaluator         { return this; }
  getBudgetProtector(): IBudgetProtector           { return this; }
  getMonitor(): IExecutionMonitor                  { return this; }
  getValidator(): IExecutionValidator              { return this; }
  getReporter(): IExecutionReporter                { return this; }

  // ===========================================================================
  // Private helpers
  // ===========================================================================
  private async _simulateExecution(request: ExecutionRequest, providerId: string, model: string): Promise<ExecutionResponse> {
    const pricing      = PROVIDER_PRICING[providerId] ?? PROVIDER_PRICING["openai"];
    const promptTokens = Math.ceil(request.prompt.length / 4);
    const compTokens   = Math.floor(promptTokens * 0.6);
    const costUsd      = (promptTokens / 1000) * pricing.prompt + (compTokens / 1000) * pricing.completion;
    return {
      requestId: request.requestId,
      providerId,
      model,
      content: `[${providerId.toUpperCase()}/${model}] Response for: "${request.prompt.slice(0, 60)}..."`,
      promptTokens,
      completionTokens: compTokens,
      totalTokens: promptTokens + compTokens,
      costUsd,
      latencyMs: pricing.latencyMs,
      cacheHit: false,
      finishReason: "stop"
    };
  }

  private _defaultModel(providerId: string): string {
    const models: Record<string, string> = {
      openai: "gpt-4o", gemini: "gemini-2.0-flash", openrouter: "anthropic/claude-3.5-sonnet",
      huggingface: "mistralai/Mistral-7B-Instruct-v0.3", ollama: "llama3.2",
      tavily: "tavily-search-basic", youtube: "youtube-data-v3",
      instagram: "instagram-graph-v18", facebook: "facebook-graph-v18"
    };
    return models[providerId] ?? "default-model";
  }

  private _initBenchmarks(): void {
    for (const [pid, p] of Object.entries(PROVIDER_PRICING)) {
      this._benchmarks.set(pid, {
        providerId: pid,
        averageLatencyMs: p.latencyMs,
        p50LatencyMs: p.latencyMs,
        p95LatencyMs: p.latencyMs * 1.5,
        successRate: 0.99,
        throughputRpm: Math.floor(60_000 / p.latencyMs),
        lastBenchmarkedAt: new Date()
      });
    }
  }

  private _updateBenchmark(providerId: string): void {
    const records = this._latencyRecords.filter(r => r.providerId === providerId);
    if (records.length === 0) return;
    const sorted = records.map(r => r.latencyMs).sort((a, b) => a - b);
    const avg    = sorted.reduce((s, v) => s + v, 0) / sorted.length;
    const p50    = sorted[Math.floor(sorted.length * 0.5)] ?? avg;
    const p95    = sorted[Math.floor(sorted.length * 0.95)] ?? avg * 1.5;
    const bench  = this._benchmarks.get(providerId);
    if (bench) {
      this._benchmarks.set(providerId, { ...bench, averageLatencyMs: avg, p50LatencyMs: p50, p95LatencyMs: p95, lastBenchmarkedAt: new Date() });
    }
  }
}
