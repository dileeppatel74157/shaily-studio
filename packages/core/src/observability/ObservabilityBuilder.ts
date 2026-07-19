import { IObservabilityEngine } from "./interfaces";
import { ObservabilityEngine } from "./ObservabilityEngine";
import { ObservabilityValidationException } from "./types";
import { ObservabilityConfiguration } from "./models";

export class ObservabilityBuilder {
  private _context?: any;
  private _config?: Partial<ObservabilityConfiguration>;

  public withContext(context: any): this {
    this._context = context;
    return this;
  }

  public withConfig(config: Partial<ObservabilityConfiguration>): this {
    this._config = config;
    return this;
  }

  public build(): IObservabilityEngine {
    if (!this._context) {
      throw new ObservabilityValidationException("Context is required to build ObservabilityEngine.");
    }

    return new ObservabilityEngine(this._context, this._config);
  }
}
