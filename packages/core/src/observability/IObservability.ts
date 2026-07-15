import { Metric } from "./Metric";
import { Span } from "./Span";
import { DiagnosticReport } from "./DiagnosticReport";
import { ObservabilitySnapshot } from "./ObservabilitySnapshot";

export interface IObservability {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  recordMetric(metric: Metric): void;
  startSpan(name: string, parentSpanId?: string, correlationId?: string, tags?: Record<string, string>): Span;
  endSpan(spanId: string): void;
  health(): DiagnosticReport;
  snapshot(): ObservabilitySnapshot;
}
