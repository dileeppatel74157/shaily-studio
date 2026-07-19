import { RuntimeEngine } from "./RuntimeEngine";
import { RuntimeConfiguration } from "./models";
import { ServiceType } from "./ServiceType";

export class Runtime extends RuntimeEngine {
  constructor(context: any, host: any, metadata?: Record<string, unknown>) {
    const config: RuntimeConfiguration = {
      env: context.env || "production",
      heartbeatIntervalMs: 5000,
      healthCheckIntervalMs: 10000,
      startupTimeoutMs: 5000,
      shutdownTimeoutMs: 5000,
      metadata: metadata || {}
    };
    super(context, config);
    if (host) {
      this.registerService({
        id: "IHost",
        type: ServiceType.CUSTOM,
        service: host
      });
    }
  }
}
