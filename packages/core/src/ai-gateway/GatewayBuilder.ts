import { IGatewayEngine } from "./interfaces";
import { GatewayEngine } from "./GatewayEngine";
import { GatewayValidationException } from "./types";
import { GatewayConfiguration } from "./models";
import { RequestRoutingStrategy } from "./RequestRoutingStrategy";
import { RetryPolicy } from "./RetryPolicy";

export class GatewayBuilder {
  private _context?: any;
  private _config?: Partial<GatewayConfiguration>;

  public withContext(context: any): this {
    this._context = context;
    return this;
  }

  public withConfig(config: Partial<GatewayConfiguration>): this {
    this._config = config;
    return this;
  }

  public build(): IGatewayEngine {
    if (!this._context) {
      throw new GatewayValidationException("Context is required to build GatewayEngine.");
    }

    const defaultConfig: GatewayConfiguration = {
      environment: "local",
      defaultTimeoutMs: 30_000,
      maxRetries: 3,
      routingStrategy: RequestRoutingStrategy.FALLBACK_CHAIN,
      retryPolicy: RetryPolicy.EXPONENTIAL,
      circuitBreakerThreshold: 5,
      enableCostTracking: true,
      enableUsageMonitor: true,
      ...this._config
    };

    return new GatewayEngine(this._context, defaultConfig);
  }
}
