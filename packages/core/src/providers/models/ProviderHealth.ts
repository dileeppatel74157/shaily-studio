export interface ProviderHealth {
  readonly status: string;
  readonly latency: number;
  readonly lastSuccessfulRequest: Date | null;
  readonly lastFailure: Date | null;
  readonly errorRate: number;
  readonly availability: number;
  // Backward compatibility fields
  readonly isHealthy?: boolean;
  readonly details?: Readonly<Record<string, unknown>>;
}
