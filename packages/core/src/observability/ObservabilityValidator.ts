import { Metric } from "./Metric";
import { MetricType } from "./MetricType";
import { Span } from "./Span";
import { DiagnosticReport } from "./DiagnosticReport";
import { HealthStatus } from "./HealthStatus";
import { ObservabilityContext } from "./ObservabilityContext";
import { ObservabilityValidationException } from "./types";

export class ObservabilityValidator {
  private static readonly METRIC_NAME_REGEX = /^[a-zA-Z0-9_.-]+$/;
  private static readonly ALLOWED_SERVICES = new Set([
    "Studio",
    "Gateway",
    "Orchestrator",
    "Router",
    "Provider Registry",
    "Message Bus",
    "MCP Server",
    "Plugin Registry",
    "Tool Registry",
  ]);

  public static validateContext(context: ObservabilityContext): void {
    if (!context) {
      throw new ObservabilityValidationException("Context cannot be null or undefined");
    }
    if (!context.env || typeof context.env !== "string" || context.env.trim() === "") {
      throw new ObservabilityValidationException("Context environment (env) is required and must be a non-empty string");
    }
    if (!context.namespace || typeof context.namespace !== "string" || context.namespace.trim() === "") {
      throw new ObservabilityValidationException("Context namespace is required and must be a non-empty string");
    }
  }

  public static validateMetric(metric: Metric): void {
    if (!metric) {
      throw new ObservabilityValidationException("Metric cannot be null or undefined");
    }
    if (!metric.name || typeof metric.name !== "string" || !this.METRIC_NAME_REGEX.test(metric.name)) {
      throw new ObservabilityValidationException(`Invalid metric name: "${metric.name}"`);
    }
    if (!Object.values(MetricType).includes(metric.type)) {
      throw new ObservabilityValidationException(`Invalid metric type: "${metric.type}"`);
    }
    if (typeof metric.value !== "number" || isNaN(metric.value)) {
      throw new ObservabilityValidationException(`Invalid metric value: ${metric.value}`);
    }
    if (!metric.timestamp || !(metric.timestamp instanceof Date) || isNaN(metric.timestamp.getTime())) {
      throw new ObservabilityValidationException("Invalid metric timestamp");
    }
  }

  public static validateHealthReport(report: DiagnosticReport): void {
    if (!report) {
      throw new ObservabilityValidationException("Diagnostic report cannot be null or undefined");
    }
    if (!report.timestamp || !(report.timestamp instanceof Date) || isNaN(report.timestamp.getTime())) {
      throw new ObservabilityValidationException("Invalid health report timestamp");
    }
    if (typeof report.isHealthy !== "boolean") {
      throw new ObservabilityValidationException("isHealthy must be a boolean");
    }
    if (!Array.isArray(report.services)) {
      throw new ObservabilityValidationException("Services must be an array");
    }

    for (const service of report.services) {
      if (!service.service || !this.ALLOWED_SERVICES.has(service.service)) {
        throw new ObservabilityValidationException(`Invalid or unsupported service name: "${service.service}"`);
      }
      if (!Object.values(HealthStatus).includes(service.status)) {
        throw new ObservabilityValidationException(`Invalid health status: "${service.status}"`);
      }
      if (typeof service.latency !== "number" || service.latency < 0 || isNaN(service.latency)) {
        throw new ObservabilityValidationException(`Invalid latency: ${service.latency}`);
      }
      if (!service.lastCheck || !(service.lastCheck instanceof Date) || isNaN(service.lastCheck.getTime())) {
        throw new ObservabilityValidationException("Invalid lastCheck timestamp");
      }
    }
  }

  public static validateSpanHierarchy(spans: readonly Span[]): void {
    const spanMap = new Map<string, Span>();
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const traverseAndMap = (s: Span) => {
      if (spanMap.has(s.id)) {
        throw new ObservabilityValidationException(`Duplicate span ID detected: "${s.id}"`);
      }
      spanMap.set(s.id, s);
      for (const child of s.childSpans) {
        traverseAndMap(child);
      }
    };

    for (const s of spans) {
      traverseAndMap(s);
    }

    const checkCycleAndTiming = (s: Span) => {
      visiting.add(s.id);

      for (const child of s.childSpans) {
        if (visiting.has(child.id)) {
          throw new ObservabilityValidationException(`Cyclic dependency detected at span: "${child.id}"`);
        }

        if (child.startTime.getTime() < s.startTime.getTime()) {
          throw new ObservabilityValidationException(
            `Invalid span hierarchy: Child span "${child.id}" startTime is before parent span "${s.id}" startTime`
          );
        }

        if (s.endTime) {
          if (!child.endTime) {
            throw new ObservabilityValidationException(
              `Invalid span hierarchy: Child span "${child.id}" is active but parent span "${s.id}" has ended`
            );
          }
          if (child.endTime.getTime() > s.endTime.getTime()) {
            throw new ObservabilityValidationException(
              `Invalid span hierarchy: Child span "${child.id}" endTime is after parent span "${s.id}" endTime`
            );
          }
        }

        if (child.context.parentSpanId !== s.id) {
          throw new ObservabilityValidationException(
            `Invalid span hierarchy: Child span "${child.id}" parentSpanId is "${child.context.parentSpanId}", expected "${s.id}"`
          );
        }

        if (!visited.has(child.id)) {
          checkCycleAndTiming(child);
        }
      }

      visiting.delete(s.id);
      visited.add(s.id);
    };

    for (const s of spans) {
      if (!visited.has(s.id)) {
        checkCycleAndTiming(s);
      }
    }
  }
}
