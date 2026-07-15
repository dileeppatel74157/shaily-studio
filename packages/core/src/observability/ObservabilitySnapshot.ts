import { Metric } from "./Metric";
import { Trace } from "./Trace";
import { DiagnosticReport } from "./DiagnosticReport";
import { MetricType } from "./MetricType";

export interface AggregatedMetric {
  readonly name: string;
  readonly type: MetricType;
  readonly count: number;
  readonly sum: number;
  readonly min: number;
  readonly max: number;
  readonly latest: number;
  readonly tags: Readonly<Record<string, string>>;
}

export interface ObservabilitySnapshot {
  readonly timestamp: Date;
  readonly metrics: readonly Metric[];
  readonly aggregatedMetrics: readonly AggregatedMetric[];
  readonly traces: readonly Trace[];
  readonly healthReport: DiagnosticReport;
  readonly metadata: Readonly<Record<string, unknown>>;
}
