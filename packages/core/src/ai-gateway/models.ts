import { GatewayState } from "./GatewayState";
import { ProviderAdapterType } from "./ProviderAdapterType";
import { RequestRoutingStrategy } from "./RequestRoutingStrategy";
import { RetryPolicy } from "./RetryPolicy";
import { CircuitBreakerState } from "./CircuitBreakerState";
import { AuthStrategy } from "./AuthStrategy";

// 1. GatewayConfiguration
export interface GatewayConfiguration {
  environment: string;
  defaultTimeoutMs: number;
  maxRetries: number;
  routingStrategy: RequestRoutingStrategy;
  retryPolicy: RetryPolicy;
  circuitBreakerThreshold: number;
  enableCostTracking: boolean;
  enableUsageMonitor: boolean;
}

// 2. GatewayRequest
export interface GatewayRequest {
  requestId: string;
  providerId: string;
  model: string;
  prompt: string;
  stream: boolean;
  maxTokens?: number;
  temperature?: number;
  metadata?: Record<string, any>;
}

// 3. GatewayResponse
export interface GatewayResponse {
  requestId: string;
  providerId: string;
  model: string;
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs: number;
  finishReason: string;
}

// 4. GatewayResponseChunk
export interface GatewayResponseChunk {
  requestId: string;
  chunkIndex: number;
  delta: string;
  done: boolean;
}

// 5. ProviderRegistryEntry
export interface ProviderRegistryEntry {
  providerId: string;
  adapterType: ProviderAdapterType;
  displayName: string;
  capabilities: ProviderCapabilities;
  priority: number;
  enabled: boolean;
  version: string;
}

// 6. ProviderCapabilities
export interface ProviderCapabilities {
  supportsStreaming: boolean;
  supportsVision: boolean;
  supportsTools: boolean;
  supportsJsonMode: boolean;
  maxContextTokens: number;
  availableModels: string[];
}

// 7. ProviderHealthStatus
export interface ProviderHealthStatus {
  providerId: string;
  healthy: boolean;
  lastChecked: Date;
  failureCount: number;
  consecutiveFails: number;
  averageLatencyMs: number;
}

// 8. AuthCredential
export interface AuthCredential {
  providerId: string;
  strategy: AuthStrategy;
  apiKey?: string;
  token?: string;
  expiresAt?: Date;
}

// 9. AuthValidationResult
export interface AuthValidationResult {
  valid: boolean;
  reason?: string;
  maskedKey?: string;
}

// 10. RetryAttempt
export interface RetryAttempt {
  requestId: string;
  attemptNumber: number;
  delayMs: number;
  error: string;
  timestamp: Date;
}

// 11. CircuitBreakerStatus
export interface CircuitBreakerStatus {
  providerId: string;
  state: CircuitBreakerState;
  openedAt?: Date;
  failures: number;
  threshold: number;
}

// 12. UsageRecord
export interface UsageRecord {
  requestId: string;
  providerId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  timestamp: Date;
}

// 13. DailyQuotaStatus
export interface DailyQuotaStatus {
  providerId: string;
  date: string;
  requestCount: number;
  tokenCount: number;
  costUsd: number;
  requestLimit: number;
  tokenLimit: number;
  costLimitUsd: number;
}

// 14. RateLimitStatus
export interface RateLimitStatus {
  providerId: string;
  requestsPerMinute: number;
  remaining: number;
  resetAt: Date;
}

// 15. ProviderCooldown
export interface ProviderCooldown {
  providerId: string;
  cooldownUntil: Date;
  reason: string;
}

// 16. GatewaySnapshot
export interface GatewaySnapshot {
  state: GatewayState;
  configuration: GatewayConfiguration;
  timestamp: Date;
}

// 17. GatewayRouteDecision
export interface GatewayRouteDecision {
  selectedProviderId: string;
  strategy: RequestRoutingStrategy;
  alternates: string[];
  reason: string;
}

// 18. GatewayReport
export interface GatewayReport {
  generatedAt: Date;
  totalRequests: number;
  totalCostUsd: number;
  averageLatencyMs: number;
  providerBreakdown: Record<string, number>;
  errorRate: number;
}

// 19. FailureTrackingEntry
export interface FailureTrackingEntry {
  providerId: string;
  timestamp: Date;
  errorCode: string;
  errorMessage: string;
  recovered: boolean;
}

// 20. LoadBalancerState
export interface LoadBalancerState {
  providerWeights: Record<string, number>;
  requestCounts: Record<string, number>;
  lastRebalancedAt: Date;
}
