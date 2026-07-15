import { HealthStatus } from "./HealthStatus";

export interface ServiceHealth {
  readonly service: string;
  readonly status: HealthStatus;
  readonly latency: number;
  readonly lastCheck: Date;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface DiagnosticReport {
  readonly timestamp: Date;
  readonly isHealthy: boolean;
  readonly services: readonly ServiceHealth[];
}
