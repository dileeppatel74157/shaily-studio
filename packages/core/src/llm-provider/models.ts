import { ProviderState } from "./ProviderState";
import { ProviderType } from "./ProviderType";
import { ModelCategory } from "./ModelCategory";
import { RequestPriority } from "./RequestPriority";
import { StreamingState } from "./StreamingState";
import { ProviderHealth } from "./ProviderHealth";
import { RoutingMode } from "./RoutingMode";
import { ProviderEventType } from "./ProviderEventType";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "function" | string;
  content: string;
  name?: string;
}

export interface LLMRequestOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  timeoutMs?: number;
  priority?: RequestPriority;
  stream?: boolean;
  fallbackEnabled?: boolean;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMRequest {
  id: string;
  provider?: ProviderType;
  model: string;
  messages: ChatMessage[];
  options?: LLMRequestOptions;
}

export interface LLMResponse {
  id: string;
  requestId: string;
  provider: ProviderType;
  model: string;
  content: string;
  role: string;
  usage?: TokenUsage;
  durationMs: number;
  cached: boolean;
}

export interface CompletionRequest {
  id: string;
  provider?: ProviderType;
  model: string;
  prompt: string;
  options?: LLMRequestOptions;
}

export interface CompletionResponse {
  id: string;
  requestId: string;
  provider: ProviderType;
  model: string;
  text: string;
  usage?: TokenUsage;
  durationMs: number;
}

export interface EmbeddingRequest {
  id: string;
  provider?: ProviderType;
  model: string;
  input: string | string[];
  options?: { timeoutMs?: number };
}

export interface EmbeddingResponse {
  id: string;
  requestId: string;
  provider: ProviderType;
  model: string;
  embeddings: number[][];
  usage?: TokenUsage;
  durationMs: number;
}

export interface StreamingChunk {
  id: string;
  requestId: string;
  provider: ProviderType;
  model: string;
  delta: string;
  state: StreamingState;
  index: number;
  usage?: TokenUsage;
}

export interface ModelInfo {
  id: string;
  name: string;
  category: ModelCategory;
  maxContextTokens: number;
  maxOutputTokens: number;
  capabilities: string[];
  inputTokenCostPerK?: number;
  outputTokenCostPerK?: number;
}

export interface FallbackConfig {
  fallbackProviders: ProviderType[];
  fallbackModels: string[];
  triggerOnStatusCodes?: number[];
  maxAttempts?: number;
}

export interface ProviderConfiguration {
  provider: ProviderType;
  apiKey?: string;
  endpoint?: string;
  models: ModelInfo[];
  defaultModel?: string;
  timeoutMs?: number;
  maxRetries?: number;
  routingMode?: RoutingMode;
  fallbackConfig?: FallbackConfig;
}

export interface ProviderCapability {
  provider: ProviderType;
  supportsStreaming: boolean;
  supportsEmbeddings: boolean;
  supportsVision: boolean;
  supportsTools: boolean;
  supportsJSONMode: boolean;
}

export interface ProviderStatistics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokensUsed: number;
  promptTokensUsed: number;
  completionTokensUsed: number;
  totalCostUSD: number;
  averageLatencyMs: number;
  activeRequests: number;
}

export interface ProviderRegistration {
  id: string;
  type: ProviderType;
  state: ProviderState;
  health: ProviderHealth;
  config: ProviderConfiguration;
  capabilities: ProviderCapability;
  lastActive?: Date;
  error?: string;
}

export interface ModelRoutingRule {
  pattern: string;
  targetProvider: ProviderType;
  targetModel: string;
  priority: number;
}

export interface ProviderHealthReport {
  timestamp: Date;
  provider: ProviderType;
  status: ProviderHealth;
  latencyMs?: number;
  errorMessage?: string;
}

export interface LLMEvent {
  type: ProviderEventType;
  timestamp: Date;
  payload?: any;
}

export interface ValidationIssue {
  rule: string;
  severity: "ERROR" | "WARNING";
  message: string;
  context?: any;
}

export interface ProviderValidationReport {
  timestamp: Date;
  valid: boolean;
  issues: ValidationIssue[];
}

export interface ProviderSnapshot {
  timestamp: Date;
  providers: ProviderRegistration[];
  statistics: Record<string, ProviderStatistics>;
  globalUsage: TokenUsage;
  metadata?: Record<string, unknown>;
}
