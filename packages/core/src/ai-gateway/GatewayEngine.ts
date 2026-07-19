import { GatewayState } from "./GatewayState";
import { ProviderAdapterType } from "./ProviderAdapterType";
import { RequestRoutingStrategy } from "./RequestRoutingStrategy";
import { CircuitBreakerState } from "./CircuitBreakerState";
import { AuthStrategy } from "./AuthStrategy";
import { GatewayEventType } from "./GatewayEventType";
import {
  IGatewayEngine,
  IProviderRegistry,
  IRequestRouter,
  IResponseManager,
  IAuthenticationManager,
  IRetryEngine,
  IUsageMonitor,
  IGatewayValidator,
  IGatewayReporter,
  IProviderAdapter
} from "./interfaces";
import {
  GatewayConfiguration,
  GatewayRequest,
  GatewayResponse,
  GatewayResponseChunk,
  ProviderRegistryEntry,
  ProviderCapabilities,
  ProviderHealthStatus,
  AuthCredential,
  AuthValidationResult,
  RetryAttempt,
  CircuitBreakerStatus,
  UsageRecord,
  DailyQuotaStatus,
  RateLimitStatus,
  ProviderCooldown,
  GatewaySnapshot,
  GatewayRouteDecision,
  GatewayReport,
  FailureTrackingEntry,
  LoadBalancerState
} from "./models";
import { GatewayValidator } from "./GatewayValidator";
import {
  InvalidGatewayStateException,
  GatewayException,
  ProviderNotFoundException,
  CircuitOpenException,
  deepFreeze
} from "./types";

// ---------------------------------------------------------------------------
// Built-in provider adapter implementations
// ---------------------------------------------------------------------------
class BuiltInAdapter implements IProviderAdapter {
  constructor(
    public readonly providerId: string,
    public readonly adapterType: ProviderAdapterType
  ) {}

  async connect(): Promise<void> { /* noop — local simulation */ }

  async execute(request: GatewayRequest): Promise<GatewayResponse> {
    const start = Date.now();
    // Simulate realistic prompt/completion token counts
    const promptTokens = Math.ceil(request.prompt.length / 4);
    const completionTokens = Math.floor(promptTokens * 0.6);
    return {
      requestId: request.requestId,
      providerId: this.providerId,
      model: request.model,
      content: `[${this.adapterType}] Response for: "${request.prompt.slice(0, 60)}..."`,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      costUsd: (promptTokens + completionTokens) * 0.000_002,
      latencyMs: Date.now() - start + 10,
      finishReason: "stop"
    };
  }

  async *stream(request: GatewayRequest): AsyncGenerator<GatewayResponseChunk> {
    const words = `[${this.adapterType}] Streaming response for: ${request.prompt}`.split(" ");
    for (let i = 0; i < words.length; i++) {
      yield {
        requestId: request.requestId,
        chunkIndex: i,
        delta: words[i] + " ",
        done: i === words.length - 1
      };
    }
  }

  async disconnect(): Promise<void> { /* noop */ }

  async healthCheck(): Promise<ProviderHealthStatus> {
    return {
      providerId: this.providerId,
      healthy: true,
      lastChecked: new Date(),
      failureCount: 0,
      consecutiveFails: 0,
      averageLatencyMs: 120
    };
  }
}

// ---------------------------------------------------------------------------
// GatewayEngine — master coordinator
// ---------------------------------------------------------------------------
export class GatewayEngine implements
  IGatewayEngine,
  IProviderRegistry,
  IRequestRouter,
  IResponseManager,
  IAuthenticationManager,
  IRetryEngine,
  IUsageMonitor,
  IGatewayValidator,
  IGatewayReporter
{
  private _state: GatewayState = GatewayState.CREATED;
  private readonly _config: GatewayConfiguration;
  private readonly _context: any;
  private readonly _validator = new GatewayValidator();

  // Registry
  private readonly _providers = new Map<string, ProviderRegistryEntry>();
  private readonly _adapters  = new Map<string, IProviderAdapter>();
  private readonly _health    = new Map<string, ProviderHealthStatus>();

  // Auth
  private readonly _credentials = new Map<string, AuthCredential>();

  // Retry / circuit-breaker
  private readonly _circuits  = new Map<string, CircuitBreakerStatus>();
  private readonly _cooldowns = new Map<string, ProviderCooldown>();
  private readonly _retryHistory = new Map<string, RetryAttempt[]>();
  private readonly _failures  : FailureTrackingEntry[] = [];

  // Usage
  private readonly _usageRecords: UsageRecord[] = [];
  private readonly _requestCounts = new Map<string, number>();
  private _totalCostUsd = 0;

  // Load-balancer state
  private _loadBalancer: LoadBalancerState = {
    providerWeights: {},
    requestCounts: {},
    lastRebalancedAt: new Date()
  };

  // Round-robin cursor
  private _rrCursor = 0;

  // Startup timestamp
  private _startedAt: Date = new Date();

  constructor(context: any, config: GatewayConfiguration) {
    this._context = context;
    this._config = config;
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================
  private transitionState(next: GatewayState): void {
    const valid: Record<GatewayState, GatewayState[]> = {
      [GatewayState.CREATED]:      [GatewayState.INITIALIZING],
      [GatewayState.INITIALIZING]: [GatewayState.RUNNING, GatewayState.ERROR],
      [GatewayState.RUNNING]:      [GatewayState.STOPPING, GatewayState.ERROR],
      [GatewayState.STOPPING]:     [GatewayState.STOPPED],
      [GatewayState.STOPPED]:      [GatewayState.INITIALIZING],
      [GatewayState.ERROR]:        [GatewayState.INITIALIZING]
    };
    if (!valid[this._state].includes(next)) {
      throw new InvalidGatewayStateException(`transition to ${next}`, this._state);
    }
    this._state = next;
  }

  async initialize(): Promise<void> {
    this.transitionState(GatewayState.INITIALIZING);
    this._validator.validate(this.getSnapshot());
    this._registerBuiltInProviders();
    this._startedAt = new Date();
    this.transitionState(GatewayState.RUNNING);
    await this._context.eventBus?.publish({ type: GatewayEventType.REQUEST_ROUTED, payload: { status: "initialized" } });
  }

  async start(): Promise<void> {
    if (this._state !== GatewayState.RUNNING) {
      await this.initialize();
    }
  }

  async stop(): Promise<void> {
    this.transitionState(GatewayState.STOPPING);
    for (const adapter of this._adapters.values()) {
      await adapter.disconnect();
    }
    this.transitionState(GatewayState.STOPPED);
  }

  getState(): GatewayState { return this._state; }

  getSnapshot(): GatewaySnapshot {
    return deepFreeze<GatewaySnapshot>({
      state: this._state,
      configuration: JSON.parse(JSON.stringify(this._config)),
      timestamp: new Date()
    });
  }

  // ===========================================================================
  // Main pipeline
  // ===========================================================================
  async execute(request: GatewayRequest): Promise<GatewayResponse> {
    this._validator.validateRequest(request.requestId, request.prompt, request.model);

    const decision = this.route(request);
    const providerId = decision.selectedProviderId;

    const adapter = this._adapters.get(providerId);
    if (!adapter) throw new ProviderNotFoundException(providerId);

    // Retry wrapper
    const response = await this.executeWithRetry(async () => {
      const start = Date.now();
      const raw = await adapter.execute({ ...request, providerId });
      return this.normalize(raw, request, Date.now() - start);
    }, providerId);

    this.collectUsage(response);
    this.countRequest(providerId);
    await this._context.eventBus?.publish({ type: GatewayEventType.RESPONSE_RECEIVED, payload: response });

    return response;
  }

  async *stream(request: GatewayRequest): AsyncGenerator<GatewayResponseChunk> {
    this._validator.validateRequest(request.requestId, request.prompt, request.model);
    this._validator.validateStreamingResponse(request.requestId);

    const decision = this.route(request);
    const adapter  = this._adapters.get(decision.selectedProviderId);
    if (!adapter) throw new ProviderNotFoundException(decision.selectedProviderId);

    yield* adapter.stream({ ...request, providerId: decision.selectedProviderId });
  }

  // ===========================================================================
  // IProviderRegistry
  // ===========================================================================
  registerProvider(entry: ProviderRegistryEntry): void {
    this._providers.set(entry.providerId, entry);
    this._health.set(entry.providerId, {
      providerId: entry.providerId,
      healthy: true,
      lastChecked: new Date(),
      failureCount: 0,
      consecutiveFails: 0,
      averageLatencyMs: 0
    });
    this._loadBalancer.providerWeights[entry.providerId] = entry.priority;
    this._loadBalancer.requestCounts[entry.providerId]   = 0;
  }

  discoverProviders(): ProviderRegistryEntry[] {
    return Array.from(this._providers.values()).filter(p => p.enabled);
  }

  getCapabilities(providerId: string): ProviderCapabilities | undefined {
    return this._providers.get(providerId)?.capabilities;
  }

  getProviderHealth(providerId: string): ProviderHealthStatus {
    return this._health.get(providerId) ?? {
      providerId,
      healthy: false,
      lastChecked: new Date(),
      failureCount: 0,
      consecutiveFails: 0,
      averageLatencyMs: 0
    };
  }

  getProviderVersion(providerId: string): string | undefined {
    return this._providers.get(providerId)?.version;
  }

  // ===========================================================================
  // IRequestRouter
  // ===========================================================================
  route(request: GatewayRequest): GatewayRouteDecision {
    const providers = this.discoverProviders();
    if (providers.length === 0) throw new GatewayException("No providers registered in gateway.");

    let selected = request.providerId;
    const strategy = this._config.routingStrategy;

    if (!this._providers.has(selected)) {
      // Auto-select using strategy
      if (strategy === RequestRoutingStrategy.ROUND_ROBIN) {
        selected = providers[this._rrCursor % providers.length].providerId;
        this._rrCursor++;
      } else if (strategy === RequestRoutingStrategy.PRIORITY) {
        selected = providers.sort((a, b) => b.priority - a.priority)[0].providerId;
      } else if (strategy === RequestRoutingStrategy.CHEAPEST) {
        selected = providers[0].providerId; // simulated cheapest
      } else {
        selected = providers[0].providerId; // default
      }
    }

    const alternates = providers.filter(p => p.providerId !== selected).map(p => p.providerId);
    this._validator.validateRouteDecision(selected);

    return { selectedProviderId: selected, strategy, alternates, reason: "auto-selected" };
  }

  selectModel(providerId: string, hint?: string): string {
    const entry = this._providers.get(providerId);
    if (!entry) return hint ?? "default-model";
    return hint ?? entry.capabilities.availableModels[0] ?? "default-model";
  }

  applyFallback(failedProviderId: string, request: GatewayRequest): string | undefined {
    const providers = this.discoverProviders().filter(p => p.providerId !== failedProviderId);
    return providers[0]?.providerId;
  }

  balanceLoad(): LoadBalancerState {
    this._loadBalancer.lastRebalancedAt = new Date();
    return { ...this._loadBalancer };
  }

  handleTimeout(requestId: string, timeoutMs: number): void {
    this._context.logger?.warn(`Request "${requestId}" timed out after ${timeoutMs}ms.`);
  }

  // ===========================================================================
  // IResponseManager
  // ===========================================================================
  normalize(raw: any, request: GatewayRequest, latencyMs: number): GatewayResponse {
    if (raw && raw.requestId) return raw as GatewayResponse; // Already normalized
    const promptTokens      = Math.ceil((request.prompt?.length ?? 0) / 4);
    const completionTokens  = Math.floor(promptTokens * 0.6);
    const cost = this.calculateCost(promptTokens, completionTokens, request.providerId);
    this._validator.validateCost(cost);
    return {
      requestId: request.requestId,
      providerId: request.providerId,
      model: request.model,
      content: String(raw?.content ?? ""),
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      costUsd: cost,
      latencyMs,
      finishReason: raw?.finishReason ?? "stop"
    };
  }

  async *streamResponse(requestId: string): AsyncGenerator<GatewayResponseChunk> {
    this._validator.validateStreamingResponse(requestId);
    yield { requestId, chunkIndex: 0, delta: "[stream placeholder]", done: true };
  }

  normalizeError(error: any, requestId: string): GatewayResponse {
    return {
      requestId,
      providerId: "error",
      model: "none",
      content: `[ERROR] ${error?.message ?? String(error)}`,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      costUsd: 0,
      latencyMs: 0,
      finishReason: "error"
    };
  }

  collectUsage(response: GatewayResponse): void {
    const record: UsageRecord = {
      requestId: response.requestId,
      providerId: response.providerId,
      promptTokens: response.promptTokens,
      completionTokens: response.completionTokens,
      totalTokens: response.totalTokens,
      costUsd: response.costUsd,
      timestamp: new Date()
    };
    this._usageRecords.push(record);
    this.trackTokens(record);
    this.trackCost(response.requestId, response.costUsd);
  }

  calculateCost(promptTokens: number, completionTokens: number, _providerId: string): number {
    const cost = (promptTokens + completionTokens) * 0.000_002;
    this._validator.validateCost(cost);
    return cost;
  }

  // ===========================================================================
  // IAuthenticationManager
  // ===========================================================================
  loadCredentials(providerId: string): AuthCredential | undefined {
    return this._credentials.get(providerId);
  }

  async refreshToken(providerId: string): Promise<AuthCredential> {
    const existing = this._credentials.get(providerId) ?? {
      providerId,
      strategy: AuthStrategy.API_KEY,
      apiKey: `refreshed-key-${providerId}`
    };
    const updated: AuthCredential = { ...existing, expiresAt: new Date(Date.now() + 3_600_000) };
    this._credentials.set(providerId, updated);
    return updated;
  }

  validateCredential(credential: AuthCredential): AuthValidationResult {
    this._validator.validateTokenExpiry(credential.expiresAt);
    if (credential.strategy === AuthStrategy.API_KEY) {
      if (!credential.apiKey || credential.apiKey.trim() === "") {
        return { valid: false, reason: "API key is empty." };
      }
      return { valid: true, maskedKey: this._maskKey(credential.apiKey) };
    }
    return { valid: true };
  }

  injectSecret(providerId: string, apiKey: string): void {
    this._validator.validateCredential(apiKey, providerId);
    this._credentials.set(providerId, { providerId, strategy: AuthStrategy.API_KEY, apiKey });
  }

  checkPermissions(providerId: string): boolean {
    const cred = this._credentials.get(providerId);
    return !!cred && this.validateCredential(cred).valid;
  }

  private _maskKey(key: string): string {
    if (key.length <= 8) return "****";
    return key.slice(0, 4) + "****" + key.slice(-4);
  }

  // ===========================================================================
  // IRetryEngine
  // ===========================================================================
  async executeWithRetry<T>(fn: () => Promise<T>, providerId: string): Promise<T> {
    const circuit = this._circuits.get(providerId);
    if (circuit?.state === CircuitBreakerState.OPEN) {
      throw new CircuitOpenException(providerId);
    }

    let lastError: any;
    for (let attempt = 1; attempt <= this._config.maxRetries + 1; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        const delay = this.applyBackoff(attempt);
        const retryAttempt: RetryAttempt = {
          requestId: `retry-${Date.now()}`,
          attemptNumber: attempt,
          delayMs: delay,
          error: String(err),
          timestamp: new Date()
        };
        const history = this._retryHistory.get(providerId) ?? [];
        history.push(retryAttempt);
        this._retryHistory.set(providerId, history);

        this.trackFailure({
          providerId,
          timestamp: new Date(),
          errorCode: "EXECUTION_ERROR",
          errorMessage: String(err),
          recovered: false
        });

        if (attempt <= this._config.maxRetries) {
          await this._sleep(delay);
        }
      }
    }
    throw lastError;
  }

  applyBackoff(attemptNumber: number): number {
    this._validator.validateRetryAttempt(attemptNumber);
    const delay = Math.min(1000 * Math.pow(2, attemptNumber - 1), 60_000);
    this._validator.validateBackoffDelay(delay);
    return delay;
  }

  openCircuit(providerId: string): void {
    this._circuits.set(providerId, {
      providerId,
      state: CircuitBreakerState.OPEN,
      openedAt: new Date(),
      failures: this._config.circuitBreakerThreshold,
      threshold: this._config.circuitBreakerThreshold
    });
    const health = this._health.get(providerId);
    if (health) {
      this._health.set(providerId, { ...health, healthy: false });
    }
  }

  cooldownProvider(providerId: string, durationMs: number): void {
    this._cooldowns.set(providerId, {
      providerId,
      cooldownUntil: new Date(Date.now() + durationMs),
      reason: `Cooldown applied for ${durationMs}ms.`
    });
  }

  trackFailure(entry: FailureTrackingEntry): void {
    this._failures.push(entry);
    const health = this._health.get(entry.providerId);
    if (health) {
      this._health.set(entry.providerId, {
        ...health,
        failureCount: health.failureCount + 1,
        consecutiveFails: health.consecutiveFails + 1
      });
    }

    // Auto-open circuit if threshold exceeded
    const updated = this._health.get(entry.providerId);
    if (updated && updated.consecutiveFails >= this._config.circuitBreakerThreshold) {
      this.openCircuit(entry.providerId);
    }
  }

  getCircuitStatus(providerId: string): CircuitBreakerStatus {
    return this._circuits.get(providerId) ?? {
      providerId,
      state: CircuitBreakerState.CLOSED,
      failures: 0,
      threshold: this._config.circuitBreakerThreshold
    };
  }

  getRetryHistory(requestId: string): RetryAttempt[] {
    return this._retryHistory.get(requestId) ?? [];
  }

  private _sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ===========================================================================
  // IUsageMonitor
  // ===========================================================================
  trackTokens(record: UsageRecord): void {
    this._validator.validateUsageRecord(record.costUsd, record.requestId);
    // accumulate per provider
    const prev = this._requestCounts.get(record.providerId) ?? 0;
    this._requestCounts.set(record.providerId, prev);
  }

  trackCost(requestId: string, costUsd: number): void {
    this._validator.validateUsageRecord(costUsd, requestId);
    this._totalCostUsd += costUsd;
  }

  countRequest(providerId: string): void {
    const prev = this._requestCounts.get(providerId) ?? 0;
    this._requestCounts.set(providerId, prev + 1);
    this._loadBalancer.requestCounts[providerId] = (this._loadBalancer.requestCounts[providerId] ?? 0) + 1;
  }

  checkRateLimit(providerId: string): RateLimitStatus {
    this._validator.validateRateLimit(60);
    const used = this._requestCounts.get(providerId) ?? 0;
    return {
      providerId,
      requestsPerMinute: 60,
      remaining: Math.max(0, 60 - used),
      resetAt: new Date(Date.now() + 60_000)
    };
  }

  checkDailyQuota(providerId: string): DailyQuotaStatus {
    this._validator.validateDailyQuota(1_000, 1_000_000);
    const used = this._requestCounts.get(providerId) ?? 0;
    const date = new Date().toISOString().split("T")[0];
    return {
      providerId,
      date,
      requestCount: used,
      tokenCount: this._usageRecords
        .filter(r => r.providerId === providerId)
        .reduce((sum, r) => sum + r.totalTokens, 0),
      costUsd: this._usageRecords
        .filter(r => r.providerId === providerId)
        .reduce((sum, r) => sum + r.costUsd, 0),
      requestLimit: 1_000,
      tokenLimit: 1_000_000,
      costLimitUsd: 50
    };
  }

  getTotalUsage(): UsageRecord[] {
    return [...this._usageRecords];
  }

  getTotalCostUsd(): number {
    return this._totalCostUsd;
  }

  // ===========================================================================
  // IGatewayValidator
  // ===========================================================================
  validate(snapshot: GatewaySnapshot): void {
    this._validator.validate(snapshot);
  }

  // ===========================================================================
  // IGatewayReporter
  // ===========================================================================
  async generateReport(): Promise<GatewayReport> {
    const totalRequests = this._usageRecords.length;
    const totalCostUsd  = this._totalCostUsd;
    const totalLatency  = this._usageRecords.reduce((s, r) => s, 0);
    const avgLatencyMs  = totalRequests > 0 ? totalLatency / totalRequests : 0;

    const breakdown: Record<string, number> = {};
    for (const [pid, count] of this._requestCounts.entries()) {
      breakdown[pid] = count;
    }

    const errorCount = this._failures.filter(f => !f.recovered).length;

    return {
      generatedAt: new Date(),
      totalRequests,
      totalCostUsd,
      averageLatencyMs: avgLatencyMs,
      providerBreakdown: breakdown,
      errorRate: totalRequests > 0 ? errorCount / totalRequests : 0
    };
  }

  // ===========================================================================
  // Sub-manager resolver delegation
  // ===========================================================================
  getRegistry(): IProviderRegistry     { return this; }
  getRouter(): IRequestRouter          { return this; }
  getResponseManager(): IResponseManager { return this; }
  getAuthManager(): IAuthenticationManager { return this; }
  getRetryEngine(): IRetryEngine        { return this; }
  getUsageMonitor(): IUsageMonitor      { return this; }
  getValidator(): IGatewayValidator     { return this; }
  getReporter(): IGatewayReporter       { return this; }

  getAdapter(providerId: string): IProviderAdapter | undefined {
    return this._adapters.get(providerId);
  }

  // ===========================================================================
  // Private — register all built-in provider adapters
  // ===========================================================================
  private _registerBuiltInProviders(): void {
    const builtIns: Array<{ id: string; type: ProviderAdapterType; name: string; models: string[]; priority: number }> = [
      { id: "openai",      type: ProviderAdapterType.OPENAI,      name: "OpenAI",      models: ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"],         priority: 100 },
      { id: "gemini",      type: ProviderAdapterType.GEMINI,      name: "Gemini",      models: ["gemini-2.0-flash", "gemini-1.5-pro"],              priority: 90  },
      { id: "openrouter",  type: ProviderAdapterType.OPENROUTER,  name: "OpenRouter",  models: ["anthropic/claude-3.5-sonnet", "meta-llama/llama-3"], priority: 80  },
      { id: "huggingface", type: ProviderAdapterType.HUGGINGFACE, name: "HuggingFace", models: ["mistralai/Mistral-7B-Instruct-v0.3"],              priority: 70  },
      { id: "ollama",      type: ProviderAdapterType.OLLAMA,      name: "Ollama",      models: ["llama3.2", "mistral", "phi3"],                     priority: 60  },
      { id: "tavily",      type: ProviderAdapterType.TAVILY,      name: "Tavily",      models: ["tavily-search-basic", "tavily-search-advanced"],   priority: 50  },
      { id: "youtube",     type: ProviderAdapterType.YOUTUBE,     name: "YouTube",     models: ["youtube-data-v3"],                                 priority: 40  },
      { id: "instagram",   type: ProviderAdapterType.INSTAGRAM,   name: "Instagram",   models: ["instagram-graph-v18"],                             priority: 30  },
      { id: "facebook",    type: ProviderAdapterType.FACEBOOK,    name: "Facebook",    models: ["facebook-graph-v18"],                              priority: 20  }
    ];

    for (const bi of builtIns) {
      const adapter = new BuiltInAdapter(bi.id, bi.type);
      this._adapters.set(bi.id, adapter);

      const entry: ProviderRegistryEntry = {
        providerId: bi.id,
        adapterType: bi.type,
        displayName: bi.name,
        capabilities: {
          supportsStreaming: true,
          supportsVision: bi.type === ProviderAdapterType.OPENAI || bi.type === ProviderAdapterType.GEMINI,
          supportsTools: bi.type === ProviderAdapterType.OPENAI || bi.type === ProviderAdapterType.GEMINI,
          supportsJsonMode: bi.type === ProviderAdapterType.OPENAI || bi.type === ProviderAdapterType.OPENROUTER,
          maxContextTokens: bi.type === ProviderAdapterType.OLLAMA ? 32_768 : 128_000,
          availableModels: bi.models
        },
        priority: bi.priority,
        enabled: true,
        version: "1.0.0"
      };

      this.registerProvider(entry);
    }
  }
}
