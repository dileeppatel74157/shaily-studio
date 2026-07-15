import { IObservability } from "./IObservability";
import { Metric } from "./Metric";
import { Span } from "./Span";
import { Trace } from "./Trace";
import { DiagnosticReport } from "./DiagnosticReport";
import { ObservabilitySnapshot } from "./ObservabilitySnapshot";
import { ObservabilityContext } from "./ObservabilityContext";
import { HealthMonitor } from "./HealthMonitor";
import { MetricsCollector } from "./MetricsCollector";
import { ObservabilityValidator } from "./ObservabilityValidator";
import {
  ObservabilityState,
  InvalidLifecycleTransitionException,
  ObservabilityValidationException,
  deepFreeze,
} from "./types";

interface SpanRecord {
  readonly id: string;
  readonly name: string;
  readonly traceId: string;
  readonly parentSpanId?: string;
  readonly correlationId: string;
  readonly startTime: Date;
  endTime?: Date;
  duration?: number;
  readonly tags: Record<string, string>;
  readonly childIds: string[];
}

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class Observability implements IObservability {
  private readonly _context: ObservabilityContext;
  private readonly _healthMonitor: HealthMonitor;
  private readonly _metricsCollector = new MetricsCollector();
  private readonly _spans = new Map<string, SpanRecord>();
  private readonly _activeSpanIdStack: string[] = [];
  private _state: ObservabilityState = ObservabilityState.CREATED;

  constructor(context: ObservabilityContext, healthMonitor: HealthMonitor) {
    ObservabilityValidator.validateContext(context);
    this._context = context;
    this._healthMonitor = healthMonitor;
  }

  public async initialize(): Promise<void> {
    if (this._state !== ObservabilityState.CREATED) {
      throw new InvalidLifecycleTransitionException("initialize", this._state);
    }
    try {
      this._state = ObservabilityState.READY;
    } catch (err) {
      this._state = ObservabilityState.FAILED;
      throw err;
    }
  }

  public async start(): Promise<void> {
    if (this._state !== ObservabilityState.READY) {
      throw new InvalidLifecycleTransitionException("start", this._state);
    }
    try {
      this._state = ObservabilityState.RUNNING;
    } catch (err) {
      this._state = ObservabilityState.FAILED;
      throw err;
    }
  }

  public async stop(): Promise<void> {
    if (this._state !== ObservabilityState.RUNNING) {
      throw new InvalidLifecycleTransitionException("stop", this._state);
    }
    try {
      this._state = ObservabilityState.STOPPED;
    } catch (err) {
      this._state = ObservabilityState.FAILED;
      throw err;
    }
  }

  public recordMetric(metric: Metric): void {
    if (this._state !== ObservabilityState.RUNNING) {
      throw new InvalidLifecycleTransitionException("recordMetric", this._state);
    }
    this._metricsCollector.record(metric);
  }

  public startSpan(
    name: string,
    parentSpanId?: string,
    correlationId?: string,
    tags?: Record<string, string>
  ): Span {
    if (this._state !== ObservabilityState.RUNNING) {
      throw new InvalidLifecycleTransitionException("startSpan", this._state);
    }

    if (!name || name.trim() === "") {
      throw new ObservabilityValidationException("Span name cannot be empty");
    }

    const spanId = generateUUID();
    let computedParentSpanId = parentSpanId;
    let traceId = generateUUID();
    let computedCorrelationId = correlationId || generateUUID();

    // Parent Span Resolution
    if (computedParentSpanId) {
      const parentRecord = this._spans.get(computedParentSpanId);
      if (!parentRecord) {
        throw new ObservabilityValidationException(
          `Parent span with ID "${computedParentSpanId}" does not exist`
        );
      }
      traceId = parentRecord.traceId;
      if (!correlationId) {
        computedCorrelationId = parentRecord.correlationId;
      }
      parentRecord.childIds.push(spanId);
    } else if (this._activeSpanIdStack.length > 0) {
      // Auto-parent to top of active span stack
      computedParentSpanId = this._activeSpanIdStack[this._activeSpanIdStack.length - 1];
      const parentRecord = this._spans.get(computedParentSpanId)!;
      traceId = parentRecord.traceId;
      if (!correlationId) {
        computedCorrelationId = parentRecord.correlationId;
      }
      parentRecord.childIds.push(spanId);
    }

    const record: SpanRecord = {
      id: spanId,
      name,
      traceId,
      parentSpanId: computedParentSpanId,
      correlationId: computedCorrelationId,
      startTime: new Date(),
      tags: tags ? { ...tags } : {},
      childIds: [],
    };

    this._spans.set(spanId, record);
    this._activeSpanIdStack.push(spanId);

    const span = this.buildSpanTree(spanId);
    return deepFreeze(span);
  }

  public endSpan(spanId: string): void {
    if (this._state !== ObservabilityState.RUNNING) {
      throw new InvalidLifecycleTransitionException("endSpan", this._state);
    }

    const record = this._spans.get(spanId);
    if (!record) {
      throw new ObservabilityValidationException(`Span with ID "${spanId}" does not exist`);
    }

    if (record.endTime) {
      throw new ObservabilityValidationException(`Span with ID "${spanId}" has already ended`);
    }

    record.endTime = new Date();
    record.duration = record.endTime.getTime() - record.startTime.getTime();

    // Remove from active stack
    const index = this._activeSpanIdStack.indexOf(spanId);
    if (index !== -1) {
      this._activeSpanIdStack.splice(index, 1);
    }
  }

  public health(): DiagnosticReport {
    if (
      this._state !== ObservabilityState.READY &&
      this._state !== ObservabilityState.RUNNING &&
      this._state !== ObservabilityState.STOPPED
    ) {
      throw new InvalidLifecycleTransitionException("health", this._state);
    }

    const report = this._healthMonitor.generateReport();
    ObservabilityValidator.validateHealthReport(report);
    return deepFreeze(report);
  }

  public snapshot(): ObservabilitySnapshot {
    if (this._state !== ObservabilityState.RUNNING && this._state !== ObservabilityState.STOPPED) {
      throw new InvalidLifecycleTransitionException("snapshot", this._state);
    }

    const healthReport = this.health();
    const rawMetrics = this._metricsCollector.getRawMetrics();
    const aggregatedMetrics = this._metricsCollector.getAggregatedMetrics();

    // Reconstruct traces
    const rootRecords = Array.from(this._spans.values()).filter(
      (r) => !r.parentSpanId
    );

    const traces: Trace[] = rootRecords.map((rootRec) => {
      const rootSpan = this.buildSpanTree(rootRec.id);
      return {
        id: rootRec.traceId,
        rootSpan,
        correlationId: rootRec.correlationId,
        timestamp: rootRec.startTime,
      };
    });

    // Validate tracing trees
    const allRootSpans = traces.map((t) => t.rootSpan);
    ObservabilityValidator.validateSpanHierarchy(allRootSpans);

    const snapshotObj: ObservabilitySnapshot = {
      timestamp: new Date(),
      metrics: rawMetrics,
      aggregatedMetrics,
      traces,
      healthReport,
      metadata: { ...this._context.metadata },
    };

    return deepFreeze(snapshotObj);
  }

  private buildSpanTree(recordId: string): Span {
    const rec = this._spans.get(recordId);
    if (!rec) {
      throw new ObservabilityValidationException(`Span record "${recordId}" not found during tree build`);
    }

    const childSpans = rec.childIds.map((childId) => this.buildSpanTree(childId));

    return {
      id: rec.id,
      name: rec.name,
      context: {
        traceId: rec.traceId,
        spanId: rec.id,
        parentSpanId: rec.parentSpanId,
        correlationId: rec.correlationId,
      },
      startTime: rec.startTime,
      endTime: rec.endTime,
      duration: rec.duration,
      tags: rec.tags,
      childSpans,
    };
  }
}
