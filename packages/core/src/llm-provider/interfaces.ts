import { ProviderState } from "./ProviderState";
import { ProviderType } from "./ProviderType";
import { ProviderHealth } from "./ProviderHealth";
import { ProviderEventType } from "./ProviderEventType";
import {
  ChatMessage,
  LLMRequestOptions,
  TokenUsage,
  LLMRequest,
  LLMResponse,
  CompletionRequest,
  CompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  StreamingChunk,
  ModelInfo,
  ProviderConfiguration,
  ProviderCapability,
  ProviderStatistics,
  ProviderRegistration,
  ModelRoutingRule,
  ProviderHealthReport,
  LLMEvent,
  ProviderSnapshot
} from "./models";

export interface ILLMProviderEngine {
  initialize(): Promise<void>;
  getState(): ProviderState;
  getSnapshot(): ProviderSnapshot;

  // Primary functions
  chat(request: LLMRequest): Promise<LLMResponse>;
  streamChat(request: LLMRequest, onChunk: (chunk: StreamingChunk) => void): Promise<LLMResponse>;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  embed(request: EmbeddingRequest): Promise<EmbeddingResponse>;

  // Sub-manager accessors
  getProviderManager(): IProviderManager;
  getModelManager(): IModelManager;
  getRouter(): IRouter;
  getStreamingManager(): IStreamingManager;
  getEmbeddingManager(): IEmbeddingManager;
  getUsageManager(): IUsageManager;
  getHealthManager(): IHealthManager;
  getEventManager(): IEventManager;
  getSnapshotManager(): ISnapshotManager;
}

export interface IProviderManager {
  registerProvider(config: ProviderConfiguration): Promise<ProviderRegistration>;
  unregisterProvider(provider: ProviderType): Promise<void>;
  getProvider(provider: ProviderType): ProviderRegistration | undefined;
  listProviders(): ProviderRegistration[];
  setProviderState(provider: ProviderType, state: ProviderState): void;
}

export interface IModelManager {
  listModels(provider?: ProviderType): ModelInfo[];
  isModelSupported(provider: ProviderType, model: string): boolean;
  getModelInfo(provider: ProviderType, model: string): ModelInfo | undefined;
}

export interface IRouter {
  routeRequest(request: LLMRequest | CompletionRequest | EmbeddingRequest): ProviderType;
  addRoutingRule(rule: ModelRoutingRule): void;
  listRoutingRules(): ModelRoutingRule[];
}

export interface IStreamingManager {
  stream(request: LLMRequest | CompletionRequest, onChunk: (chunk: StreamingChunk) => void): Promise<void>;
}

export interface IEmbeddingManager {
  embed(request: EmbeddingRequest): Promise<EmbeddingResponse>;
}

export interface IUsageManager {
  getUsage(provider?: ProviderType): TokenUsage;
  recordUsage(provider: ProviderType, usage: TokenUsage): void;
  resetUsage(): void;
  getStatistics(provider?: ProviderType): ProviderStatistics;
  recordRequest(provider: ProviderType, durationMs: number, success: boolean, tokens?: TokenUsage): void;
}

export interface IHealthManager {
  checkHealth(provider: ProviderType): Promise<ProviderHealthReport>;
  checkAllHealth(): Promise<ProviderHealthReport[]>;
  getHealthStatus(provider: ProviderType): ProviderHealth;
}

export interface IEventManager {
  on(eventType: ProviderEventType, handler: (event: LLMEvent) => void): void;
  off(eventType: ProviderEventType, handler: (event: LLMEvent) => void): void;
  emit(eventType: ProviderEventType, payload?: any): void;
}

export interface ISnapshotManager {
  takeSnapshot(): ProviderSnapshot;
}
