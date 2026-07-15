import { IObservability } from "./IObservability";
import { Observability } from "./Observability";
import { ObservabilityContext } from "./ObservabilityContext";
import { HealthMonitor } from "./HealthMonitor";
import { ObservabilityValidator } from "./ObservabilityValidator";
import { ObservabilityValidationException } from "./types";

export class ObservabilityBuilder {
  private _context?: ObservabilityContext;
  private _healthMonitor?: HealthMonitor;
  private _metadata: Record<string, unknown> = {};

  public withContext(context: ObservabilityContext): this {
    this._context = context;
    return this;
  }

  public withHealthMonitor(monitor: HealthMonitor): this {
    this._healthMonitor = monitor;
    return this;
  }

  public withMetadata(metadata: Record<string, unknown>): this {
    this._metadata = { ...this._metadata, ...metadata };
    return this;
  }

  public build(): IObservability {
    if (!this._context) {
      throw new ObservabilityValidationException(
        "ObservabilityContext is required to build Observability."
      );
    }

    // Deep merge context metadata and builder metadata
    const finalContext: ObservabilityContext = {
      env: this._context.env,
      namespace: this._context.namespace,
      metadata: { ...this._context.metadata, ...this._metadata },
    };

    ObservabilityValidator.validateContext(finalContext);

    const finalHealthMonitor = this._healthMonitor || new HealthMonitor();

    return new Observability(finalContext, finalHealthMonitor);
  }
}
