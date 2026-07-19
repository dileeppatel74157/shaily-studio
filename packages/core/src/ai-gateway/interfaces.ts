import { GatewayState } from "./GatewayState";
import { ProviderAdapterType } from "./ProviderAdapterType";
import {
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

// --- Sub-Manager Interfaces ---

export interface IProviderRegistry {
  registerProvider(entry: ProviderRegistryEntry): void;
  discoverProviders(): ProviderRegistryEntry[];
  getCapabilities(providerId: string): ProviderCapabilities | undefined;
  getProviderHealth(providerId: string): ProviderHealthStatus;
  getProviderVersion(providerId: string): string | undefined;
}

export interface IRequestRouter {
  route(request: GatewayRequest): GatewayRouteDecision;
  selectModel(providerId: string, hint?: string): string;
  applyFallback(failedProviderId: string, request: GatewayRequest): string | undefined;
  balanceLoad(): LoadBalancerState;
  handleTimeout(requestId: string, timeoutMs: number): void;
}

export interface IResponseManager {
  normalize(raw: any, request: GatewayRequest, latencyMs: number): GatewayResponse;
  streamResponse(requestId: string): AsyncGenerator<GatewayResponseChunk>;
  normalizeError(error: any, requestId: string): GatewayResponse;
  collectUsage(response: GatewayResponse): void;
  calculateCost(promptTokens: number, completionTokens: number, providerId: string): number;
}

export interface IAuthenticationManager {
  loadCredentials(providerId: string): AuthCredential | undefined;
  refreshToken(providerId: string): Promise<AuthCredential>;
  validateCredential(credential: AuthCredential): AuthValidationResult;
  injectSecret(providerId: string, apiKey: string): void;
  checkPermissions(providerId: string): boolean;
}

export interface IRetryEngine {
  executeWithRetry<T>(fn: () => Promise<T>, providerId: string): Promise<T>;
  applyBackoff(attemptNumber: number): number;
  openCircuit(providerId: string): void;
  cooldownProvider(providerId: string, durationMs: number): void;
  trackFailure(entry: FailureTrackingEntry): void;
  getCircuitStatus(providerId: string): CircuitBreakerStatus;
  getRetryHistory(requestId: string): RetryAttempt[];
}

export interface IUsageMonitor {
  trackTokens(record: UsageRecord): void;
  trackCost(requestId: string, costUsd: number): void;
  countRequest(providerId: string): void;
  checkRateLimit(providerId: string): RateLimitStatus;
  checkDailyQuota(providerId: string): DailyQuotaStatus;
  getTotalUsage(): UsageRecord[];
  getTotalCostUsd(): number;
}

export interface IGatewayValidator {
  validate(snapshot: GatewaySnapshot): void;
}

export interface IGatewayReporter {
  generateReport(): Promise<GatewayReport>;
}

export interface IProviderAdapter {
  readonly providerId: string;
  readonly adapterType: ProviderAdapterType;
  connect(): Promise<void>;
  execute(request: GatewayRequest): Promise<GatewayResponse>;
  stream(request: GatewayRequest): AsyncGenerator<GatewayResponseChunk>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<ProviderHealthStatus>;
}

// --- Master Gateway Engine Interface ---

export interface IGatewayEngine {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;

  getState(): GatewayState;
  getSnapshot(): GatewaySnapshot;

  execute(request: GatewayRequest): Promise<GatewayResponse>;
  stream(request: GatewayRequest): AsyncGenerator<GatewayResponseChunk>;

  getRegistry(): IProviderRegistry;
  getRouter(): IRequestRouter;
  getResponseManager(): IResponseManager;
  getAuthManager(): IAuthenticationManager;
  getRetryEngine(): IRetryEngine;
  getUsageMonitor(): IUsageMonitor;
  getAdapter(providerId: string): IProviderAdapter | undefined;
  getValidator(): IGatewayValidator;
  getReporter(): IGatewayReporter;
}
