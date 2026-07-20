import { ILLMProviderEngine, IProviderManager, IModelManager, IRouter,
  IStreamingManager, IEmbeddingManager, IUsageManager, IHealthManager,
  IEventManager, ISnapshotManager } from "./interfaces";
import { ProviderState } from "./ProviderState";
import { ProviderType } from "./ProviderType";
import { ModelCategory } from "./ModelCategory";
import { RequestPriority } from "./RequestPriority";
import { StreamingState } from "./StreamingState";
import { ProviderHealth } from "./ProviderHealth";
import { RoutingMode } from "./RoutingMode";
import { ProviderEventType } from "./ProviderEventType";
import { LLMProviderValidator } from "./LLMProviderValidator";
import {
  ChatMessage, LLMRequestOptions, TokenUsage, LLMRequest, LLMResponse,
  CompletionRequest, CompletionResponse, EmbeddingRequest, EmbeddingResponse,
  StreamingChunk, ModelInfo, ProviderConfiguration, ProviderCapability,
  ProviderStatistics, ProviderRegistration, ModelRoutingRule,
  ProviderHealthReport, LLMEvent, ProviderSnapshot
} from "./models";
import {
  LLMProviderException, ProviderNotFoundException, ModelUnsupportedException,
  RequestTimeoutException, RateLimitException, StreamingException,
  EmbeddingException, InvalidProviderStateException, deepFreeze
} from "./types";

// ─── 1. ProviderManagerImpl ──────────────────────────────────────────────────
class ProviderManagerImpl implements IProviderManager {
  private readonly _providers = new Map<ProviderType, ProviderRegistration>();

  constructor(private readonly _engine: LLMProviderEngine) {}

  async registerProvider(config: ProviderConfiguration): Promise<ProviderRegistration> {
    LLMProviderValidator.validateProviderConfig(config);
    LLMProviderValidator.validateApiKey(config);
    LLMProviderValidator.validateFallbackConfig(config);

    const capabilities: ProviderCapability = {
      provider: config.provider,
      supportsStreaming: config.provider !== ProviderType.CUSTOM,
      supportsEmbeddings: config.models.some(m => m.category === ModelCategory.EMBEDDING),
      supportsVision: config.models.some(m => m.capabilities.includes("vision")),
      supportsTools: config.models.some(m => m.capabilities.includes("tools")),
      supportsJSONMode: config.models.some(m => m.capabilities.includes("json"))
    };

    const registration: ProviderRegistration = {
      id: `prov-${config.provider.toLowerCase()}`,
      type: config.provider,
      state: ProviderState.READY,
      health: ProviderHealth.HEALTHY,
      config,
      capabilities
    };

    this._providers.set(config.provider, registration);
    this._engine.getEventManager().emit(ProviderEventType.REGISTERED, { provider: config.provider });
    return registration;
  }

  async unregisterProvider(provider: ProviderType): Promise<void> {
    if (!this._providers.has(provider)) {
      throw new ProviderNotFoundException(provider);
    }
    this._providers.delete(provider);
    this._engine.getEventManager().emit(ProviderEventType.UNREGISTERED, { provider });
  }

  getProvider(provider: ProviderType): ProviderRegistration | undefined {
    return this._providers.get(provider);
  }

  listProviders(): ProviderRegistration[] {
    return Array.from(this._providers.values());
  }

  setProviderState(provider: ProviderType, state: ProviderState): void {
    const reg = this._providers.get(provider);
    if (!reg) throw new ProviderNotFoundException(provider);
    reg.state = state;
  }
}

// ─── 2. ModelManagerImpl ─────────────────────────────────────────────────────
class ModelManagerImpl implements IModelManager {
  constructor(private readonly _engine: LLMProviderEngine) {}

  listModels(provider?: ProviderType): ModelInfo[] {
    if (provider) {
      const reg = this._engine.getProviderManager().getProvider(provider);
      return reg ? reg.config.models : [];
    }
    return this._engine.getProviderManager().listProviders().flatMap(p => p.config.models);
  }

  isModelSupported(provider: ProviderType, model: string): boolean {
    const reg = this._engine.getProviderManager().getProvider(provider);
    if (!reg) return false;
    return reg.config.models.some(m => m.id === model);
  }

  getModelInfo(provider: ProviderType, model: string): ModelInfo | undefined {
    const reg = this._engine.getProviderManager().getProvider(provider);
    if (!reg) return undefined;
    return reg.config.models.find(m => m.id === model);
  }
}

// ─── 3. RouterImpl ───────────────────────────────────────────────────────────
class RouterImpl implements IRouter {
  private readonly _rules: ModelRoutingRule[] = [];

  constructor(private readonly _engine: LLMProviderEngine) {}

  routeRequest(request: LLMRequest | CompletionRequest | EmbeddingRequest): ProviderType {
    // 1. Try pattern rules
    for (const rule of this._rules.sort((a, b) => b.priority - a.priority)) {
      const regex = new RegExp(rule.pattern);
      if (regex.test(request.model)) {
        return rule.targetProvider;
      }
    }

    // 2. Try routing by explicit request.provider
    if (request.provider) {
      return request.provider;
    }

    // 3. Match model in registered providers
    const providers = this._engine.getProviderManager().listProviders();
    for (const prov of providers) {
      if (prov.config.models.some(m => m.id === request.model)) {
        return prov.type;
      }
    }

    // 4. Default to first registered provider
    if (providers.length > 0) {
      return providers[0].type;
    }

    throw new LLMProviderException(`No provider available to route model "${request.model}".`);
  }

  addRoutingRule(rule: ModelRoutingRule): void {
    LLMProviderValidator.validateRoutingRule(rule);
    this._rules.push(rule);
  }

  listRoutingRules(): ModelRoutingRule[] {
    return [...this._rules];
  }
}

// ─── 4. StreamingManagerImpl ──────────────────────────────────────────────────
class StreamingManagerImpl implements IStreamingManager {
  constructor(private readonly _engine: LLMProviderEngine) {}

  async stream(request: LLMRequest | CompletionRequest, onChunk: (chunk: StreamingChunk) => void): Promise<void> {
    const provider = this._engine.getRouter().routeRequest(request);
    const reg = this._engine.getProviderManager().getProvider(provider);
    if (!reg) throw new ProviderNotFoundException(provider);

    LLMProviderValidator.validateModelSupported(reg, request.model);
    LLMProviderValidator.validateStreamingCapability(reg, true);

    const isChat = "messages" in request;
    const promptText = isChat
      ? (request as LLMRequest).messages.map(m => m.content).join(" ")
      : (request as CompletionRequest).prompt;

    const words = promptText.split(" ");
    const simulatedResponse = `[Mock ${provider} stream response for ${request.model}] Received instruction: "${words.slice(0, 5).join(" ")}..."`;
    const responseWords = simulatedResponse.split(" ");

    this._engine.getEventManager().emit(ProviderEventType.REQUEST_STARTED, { requestId: request.id, provider, model: request.model });

    let index = 0;
    for (const word of responseWords) {
      await new Promise(r => setTimeout(r, 10)); // simulated streaming speed
      const delta = word + " ";
      onChunk({
        id: `chunk-${Date.now()}-${index}`,
        requestId: request.id,
        provider,
        model: request.model,
        delta,
        state: StreamingState.ACTIVE,
        index: index++
      });
    }

    const usage: TokenUsage = {
      promptTokens: Math.floor(promptText.length / 4) + 5,
      completionTokens: Math.floor(simulatedResponse.length / 4) + 5,
      totalTokens: 0
    };
    usage.totalTokens = usage.promptTokens + usage.completionTokens;

    // final completion chunk
    onChunk({
      id: `chunk-final-${request.id}`,
      requestId: request.id,
      provider,
      model: request.model,
      delta: "",
      state: StreamingState.COMPLETED,
      index,
      usage
    });

    this._engine.getUsageManager().recordRequest(provider, index * 10, true, usage);
    this._engine.getEventManager().emit(ProviderEventType.REQUEST_COMPLETED, { requestId: request.id, provider, model: request.model, usage });
  }
}

// ─── 5. EmbeddingManagerImpl ──────────────────────────────────────────────────
class EmbeddingManagerImpl implements IEmbeddingManager {
  constructor(private readonly _engine: LLMProviderEngine) {}

  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    LLMProviderValidator.validateEmbeddingInput(request.input);

    const provider = this._engine.getRouter().routeRequest(request);
    const reg = this._engine.getProviderManager().getProvider(provider);
    if (!reg) throw new ProviderNotFoundException(provider);

    LLMProviderValidator.validateModelSupported(reg, request.model);
    LLMProviderValidator.validateEmbeddingCapability(reg);

    const start = Date.now();
    this._engine.getEventManager().emit(ProviderEventType.REQUEST_STARTED, { requestId: request.id, provider, model: request.model });

    // Generate mock embeddings of 1536 dimensions
    const inputs = Array.isArray(request.input) ? request.input : [request.input];
    const embeddings = inputs.map(() =>
      Array.from({ length: 1536 }, () => Math.random() - 0.5)
    );

    const durationMs = Date.now() - start;
    const promptLen = inputs.join(" ").length;
    const usage: TokenUsage = {
      promptTokens: Math.floor(promptLen / 4) + 1,
      completionTokens: 0,
      totalTokens: Math.floor(promptLen / 4) + 1
    };

    this._engine.getUsageManager().recordRequest(provider, durationMs, true, usage);
    this._engine.getEventManager().emit(ProviderEventType.REQUEST_COMPLETED, { requestId: request.id, provider, model: request.model, usage });

    return {
      id: `emb-resp-${Date.now()}`,
      requestId: request.id,
      provider,
      model: request.model,
      embeddings,
      usage,
      durationMs
    };
  }
}

// ─── 6. UsageManagerImpl ─────────────────────────────────────────────────────
class UsageManagerImpl implements IUsageManager {
  private readonly _stats = new Map<ProviderType, ProviderStatistics>();
  private readonly _usages = new Map<ProviderType, TokenUsage>();

  constructor(private readonly _engine: LLMProviderEngine) {}

  private getOrInitStats(provider: ProviderType): ProviderStatistics {
    let stat = this._stats.get(provider);
    if (!stat) {
      stat = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalTokensUsed: 0,
        promptTokensUsed: 0,
        completionTokensUsed: 0,
        totalCostUSD: 0,
        averageLatencyMs: 0,
        activeRequests: 0
      };
      this._stats.set(provider, stat);
    }
    return stat;
  }

  private getOrInitUsage(provider: ProviderType): TokenUsage {
    let use = this._usages.get(provider);
    if (!use) {
      use = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
      this._usages.set(provider, use);
    }
    return use;
  }

  getUsage(provider?: ProviderType): TokenUsage {
    if (provider) {
      return this.getOrInitUsage(provider);
    }
    const total = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    for (const u of this._usages.values()) {
      total.promptTokens += u.promptTokens;
      total.completionTokens += u.completionTokens;
      total.totalTokens += u.totalTokens;
    }
    return total;
  }

  recordUsage(provider: ProviderType, usage: TokenUsage): void {
    LLMProviderValidator.validateTokenUsage(usage);
    const u = this.getOrInitUsage(provider);
    u.promptTokens += usage.promptTokens;
    u.completionTokens += usage.completionTokens;
    u.totalTokens += usage.totalTokens;

    const s = this.getOrInitStats(provider);
    s.totalTokensUsed += usage.totalTokens;
    s.promptTokensUsed += usage.promptTokens;
    s.completionTokensUsed += usage.completionTokens;
    // mock cost: prompt = $0.0015/1k, completion = $0.002/1k
    s.totalCostUSD += (usage.promptTokens * 0.0015 + usage.completionTokens * 0.002) / 1000;
  }

  recordRequest(provider: ProviderType, durationMs: number, success: boolean, tokens?: TokenUsage): void {
    const s = this.getOrInitStats(provider);
    s.totalRequests++;
    if (success) {
      s.successfulRequests++;
      s.averageLatencyMs = (s.averageLatencyMs * (s.successfulRequests - 1) + durationMs) / s.successfulRequests;
      if (tokens) {
        this.recordUsage(provider, tokens);
      }
    } else {
      s.failedRequests++;
    }
  }

  resetUsage(): void {
    this._usages.clear();
    this._stats.clear();
  }

  getStatistics(provider?: ProviderType): ProviderStatistics {
    if (provider) {
      return this.getOrInitStats(provider);
    }
    const globalStats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalTokensUsed: 0,
      promptTokensUsed: 0,
      completionTokensUsed: 0,
      totalCostUSD: 0,
      averageLatencyMs: 0,
      activeRequests: 0
    };
    let count = 0;
    for (const s of this._stats.values()) {
      globalStats.totalRequests += s.totalRequests;
      globalStats.successfulRequests += s.successfulRequests;
      globalStats.failedRequests += s.failedRequests;
      globalStats.totalTokensUsed += s.totalTokensUsed;
      globalStats.promptTokensUsed += s.promptTokensUsed;
      globalStats.completionTokensUsed += s.completionTokensUsed;
      globalStats.totalCostUSD += s.totalCostUSD;
      globalStats.averageLatencyMs += s.averageLatencyMs;
      if (s.totalRequests > 0) count++;
    }
    if (count > 0) {
      globalStats.averageLatencyMs /= count;
    }
    return globalStats;
  }
}

// ─── 7. HealthManagerImpl ─────────────────────────────────────────────────────
class HealthManagerImpl implements IHealthManager {
  constructor(private readonly _engine: LLMProviderEngine) {}

  async checkHealth(provider: ProviderType): Promise<ProviderHealthReport> {
    const reg = this._engine.getProviderManager().getProvider(provider);
    if (!reg) {
      return {
        timestamp: new Date(),
        provider,
        status: ProviderHealth.UNKNOWN,
        errorMessage: "Provider not registered."
      };
    }
    // Simulate simple health check latency
    const start = Date.now();
    await new Promise(r => setTimeout(r, 0));
    const latencyMs = Date.now() - start;

    reg.health = ProviderHealth.HEALTHY;
    return {
      timestamp: new Date(),
      provider,
      status: ProviderHealth.HEALTHY,
      latencyMs
    };
  }

  async checkAllHealth(): Promise<ProviderHealthReport[]> {
    const providers = this._engine.getProviderManager().listProviders();
    return Promise.all(providers.map(p => this.checkHealth(p.type)));
  }

  getHealthStatus(provider: ProviderType): ProviderHealth {
    const reg = this._engine.getProviderManager().getProvider(provider);
    return reg ? reg.health : ProviderHealth.UNKNOWN;
  }
}

// ─── 8. EventManagerImpl ──────────────────────────────────────────────────────
class EventManagerImpl implements IEventManager {
  private readonly _handlers = new Map<ProviderEventType, Set<(event: LLMEvent) => void>>();

  constructor(private readonly _engine: LLMProviderEngine) {}

  on(eventType: ProviderEventType, handler: (event: LLMEvent) => void): void {
    if (!this._handlers.has(eventType)) {
      this._handlers.set(eventType, new Set());
    }
    this._handlers.get(eventType)!.add(handler);
  }

  off(eventType: ProviderEventType, handler: (event: LLMEvent) => void): void {
    this._handlers.get(eventType)?.delete(handler);
  }

  emit(eventType: ProviderEventType, payload?: any): void {
    const set = this._handlers.get(eventType);
    if (!set) return;
    const event: LLMEvent = {
      type: eventType,
      timestamp: new Date(),
      payload
    };
    for (const h of set) {
      h(event);
    }
  }
}

// ─── 9. SnapshotManagerImpl ───────────────────────────────────────────────────
class SnapshotManagerImpl implements ISnapshotManager {
  constructor(private readonly _engine: LLMProviderEngine) {}

  takeSnapshot(): ProviderSnapshot {
    const providersCopy = this._engine.getProviderManager().listProviders().map(p => ({
      ...p,
      config: { ...p.config, models: p.config.models.map(m => ({ ...m })) },
      capabilities: { ...p.capabilities }
    }));

    const statistics: Record<string, ProviderStatistics> = {};
    for (const p of this._engine.getProviderManager().listProviders()) {
      statistics[p.type] = { ...this._engine.getUsageManager().getStatistics(p.type) };
    }

    return deepFreeze<ProviderSnapshot>({
      timestamp: new Date(),
      providers: providersCopy,
      statistics,
      globalUsage: { ...this._engine.getUsageManager().getUsage() }
    });
  }
}

// ─── 10. LLMProviderEngine ────────────────────────────────────────────────────
export class LLMProviderEngine implements ILLMProviderEngine {
  private _state = ProviderState.CREATED;

  private readonly _providerManager: ProviderManagerImpl;
  private readonly _modelManager: ModelManagerImpl;
  private readonly _router: RouterImpl;
  private readonly _streamingManager: StreamingManagerImpl;
  private readonly _embeddingManager: EmbeddingManagerImpl;
  private readonly _usageManager: UsageManagerImpl;
  private readonly _healthManager: HealthManagerImpl;
  private readonly _eventManager: EventManagerImpl;
  private readonly _snapshotManager: SnapshotManagerImpl;

  constructor(private readonly _context: any) {
    LLMProviderValidator.validateContext(_context);

    this._providerManager  = new ProviderManagerImpl(this);
    this._modelManager     = new ModelManagerImpl(this);
    this._router           = new RouterImpl(this);
    this._streamingManager = new StreamingManagerImpl(this);
    this._embeddingManager = new EmbeddingManagerImpl(this);
    this._usageManager     = new UsageManagerImpl(this);
    this._healthManager    = new HealthManagerImpl(this);
    this._eventManager     = new EventManagerImpl(this);
    this._snapshotManager  = new SnapshotManagerImpl(this);
  }

  async initialize(): Promise<void> {
    if (this._state === ProviderState.READY) {
      this._state = ProviderState.CREATED;
    }
    if (this._state !== ProviderState.CREATED) {
      throw new InvalidProviderStateException("initialize", this._state);
    }
    this._state = ProviderState.INITIALIZING;
    // mock baseline latency
    await new Promise(r => setTimeout(r, 0));
    this._state = ProviderState.READY;
  }

  getState(): ProviderState {
    return this._state;
  }

  getSnapshot(): ProviderSnapshot {
    return this._snapshotManager.takeSnapshot();
  }

  // ─── Chat Completion ────────────────────────────────────────────────────────
  async chat(request: LLMRequest): Promise<LLMResponse> {
    LLMProviderValidator.validateMessagesNotEmpty(request.messages);
    LLMProviderValidator.validateTemperature(request.options?.temperature);
    LLMProviderValidator.validateRequestPriority(request.options?.priority);

    let provider = this._router.routeRequest(request);
    let reg = this._providerManager.getProvider(provider);

    // Automatic failover fallback simulation
    if ((!reg || reg.health === ProviderHealth.UNHEALTHY) && request.options?.fallbackEnabled !== false) {
      const globalConfig = reg?.config;
      if (globalConfig?.fallbackConfig?.fallbackProviders?.length) {
        const fallbackProv = globalConfig.fallbackConfig.fallbackProviders[0];
        const fallbackReg = this._providerManager.getProvider(fallbackProv);
        if (fallbackReg && fallbackReg.health === ProviderHealth.HEALTHY) {
          this._eventManager.emit(ProviderEventType.FALLBACK_TRIGGERED, {
            fromProvider: provider,
            toProvider: fallbackProv,
            reason: "Source provider unhealthy or not registered."
          });
          provider = fallbackProv;
          reg = fallbackReg;
          // map to fallback model if specified
          if (globalConfig.fallbackConfig.fallbackModels?.length) {
            request.model = globalConfig.fallbackConfig.fallbackModels[0];
          }
        }
      }
    }

    if (!reg) throw new ProviderNotFoundException(provider);
    LLMProviderValidator.validateModelSupported(reg, request.model);

    const start = Date.now();
    this._eventManager.emit(ProviderEventType.REQUEST_STARTED, { requestId: request.id, provider, model: request.model });

    // Mock completion logic
    const promptLength = request.messages.map(m => m.content).join(" ").length;
    const responseText = `[Mock Response from ${provider} for model ${request.model}] Received messages count: ${request.messages.length}`;
    const durationMs = Date.now() - start;

    const usage: TokenUsage = {
      promptTokens: Math.floor(promptLength / 4) + 5,
      completionTokens: Math.floor(responseText.length / 4) + 5,
      totalTokens: 0
    };
    usage.totalTokens = usage.promptTokens + usage.completionTokens;

    this._usageManager.recordRequest(provider, durationMs, true, usage);
    this._eventManager.emit(ProviderEventType.REQUEST_COMPLETED, { requestId: request.id, provider, model: request.model, usage });

    return {
      id: `chat-resp-${Date.now()}`,
      requestId: request.id,
      provider,
      model: request.model,
      content: responseText,
      role: "assistant",
      usage,
      durationMs,
      cached: false
    };
  }

  // ─── Streaming Chat Completion ──────────────────────────────────────────────
  async streamChat(request: LLMRequest, onChunk: (chunk: StreamingChunk) => void): Promise<LLMResponse> {
    LLMProviderValidator.validateMessagesNotEmpty(request.messages);
    LLMProviderValidator.validateTemperature(request.options?.temperature);
    LLMProviderValidator.validateRequestPriority(request.options?.priority);

    const provider = this._router.routeRequest(request);
    const start = Date.now();

    await this._streamingManager.stream(request, onChunk);

    const promptLength = request.messages.map(m => m.content).join(" ").length;
    const responseText = `[Mock Response from ${provider} for model ${request.model}] Stream finished`;
    const usage: TokenUsage = {
      promptTokens: Math.floor(promptLength / 4) + 5,
      completionTokens: Math.floor(responseText.length / 4) + 5,
      totalTokens: 0
    };
    usage.totalTokens = usage.promptTokens + usage.completionTokens;

    return {
      id: `chat-stream-resp-${Date.now()}`,
      requestId: request.id,
      provider,
      model: request.model,
      content: responseText,
      role: "assistant",
      usage,
      durationMs: Date.now() - start,
      cached: false
    };
  }

  // ─── Complete (legacy prompt interface) ──────────────────────────────────────
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    LLMProviderValidator.validatePromptNotEmpty(request.prompt);
    LLMProviderValidator.validateTemperature(request.options?.temperature);

    const provider = this._router.routeRequest(request);
    const reg = this._providerManager.getProvider(provider);
    if (!reg) throw new ProviderNotFoundException(provider);

    LLMProviderValidator.validateModelSupported(reg, request.model);

    const start = Date.now();
    this._eventManager.emit(ProviderEventType.REQUEST_STARTED, { requestId: request.id, provider, model: request.model });

    const responseText = `[Mock Completion response from ${provider} for model ${request.model}] Received prompt.`;
    const durationMs = Date.now() - start;

    const usage: TokenUsage = {
      promptTokens: Math.floor(request.prompt.length / 4) + 5,
      completionTokens: Math.floor(responseText.length / 4) + 5,
      totalTokens: 0
    };
    usage.totalTokens = usage.promptTokens + usage.completionTokens;

    this._usageManager.recordRequest(provider, durationMs, true, usage);
    this._eventManager.emit(ProviderEventType.REQUEST_COMPLETED, { requestId: request.id, provider, model: request.model, usage });

    return {
      id: `compl-resp-${Date.now()}`,
      requestId: request.id,
      provider,
      model: request.model,
      text: responseText,
      usage,
      durationMs
    };
  }

  // ─── Embedding ─────────────────────────────────────────────────────────────
  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    return this._embeddingManager.embed(request);
  }

  // ─── Managers Accessors ────────────────────────────────────────────────────
  getProviderManager(): IProviderManager { return this._providerManager; }
  getModelManager(): IModelManager       { return this._modelManager; }
  getRouter(): IRouter                   { return this._router; }
  getStreamingManager(): IStreamingManager { return this._streamingManager; }
  getEmbeddingManager(): IEmbeddingManager { return this._embeddingManager; }
  getUsageManager(): IUsageManager       { return this._usageManager; }
  getHealthManager(): IHealthManager     { return this._healthManager; }
  getEventManager(): IEventManager       { return this._eventManager; }
  getSnapshotManager(): ISnapshotManager { return this._snapshotManager; }
}
