export interface TeamMetrics {
  readonly executionLatencyMs: number;
  readonly retriesCount: number;
  readonly failuresCount: number;
  readonly successRatio: number;
  readonly utilization: number;
  readonly throughput: number;
}
