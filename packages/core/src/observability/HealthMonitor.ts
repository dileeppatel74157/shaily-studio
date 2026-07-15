import { HealthStatus } from "./HealthStatus";
import { DiagnosticReport, ServiceHealth } from "./DiagnosticReport";
import { ObservabilityValidationException } from "./types";

export class HealthMonitor {
  private readonly _services = new Map<string, ServiceHealth>();
  private readonly _allowedServices = new Set([
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

  constructor() {
    for (const service of this._allowedServices) {
      this._services.set(service, {
        service,
        status: HealthStatus.HEALTHY,
        latency: 0,
        lastCheck: new Date(),
        metadata: {},
      });
    }
  }

  public recordHealth(
    service: string,
    status: HealthStatus,
    latency: number,
    metadata?: Record<string, unknown>
  ): void {
    if (!this._allowedServices.has(service)) {
      throw new ObservabilityValidationException(`Unknown or unsupported service: "${service}"`);
    }
    if (!Object.values(HealthStatus).includes(status)) {
      throw new ObservabilityValidationException(`Invalid health status: "${status}"`);
    }
    if (typeof latency !== "number" || latency < 0 || isNaN(latency)) {
      throw new ObservabilityValidationException(`Latency must be a non-negative number, got: ${latency}`);
    }

    const record: ServiceHealth = {
      service,
      status,
      latency,
      lastCheck: new Date(),
      metadata: metadata ? { ...metadata } : {},
    };

    this._services.set(service, record);
  }

  public generateReport(): DiagnosticReport {
    const services = Array.from(this._services.values());
    const isHealthy = services.every((s) => s.status !== HealthStatus.UNHEALTHY);
    
    return {
      timestamp: new Date(),
      isHealthy,
      services,
    };
  }
}
