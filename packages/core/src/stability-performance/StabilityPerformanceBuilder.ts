import { IStabilityPerformanceEngine } from "./interfaces";
import { StabilityPerformanceEngine } from "./StabilityPerformanceEngine";
import { StabilityValidationException } from "./types";
import { StabilityConfiguration } from "./models";

export class StabilityPerformanceBuilder {
  private _context?: any;
  private _config?: Partial<StabilityConfiguration>;

  public withContext(context: any): this {
    this._context = context;
    return this;
  }

  public withConfig(config: Partial<StabilityConfiguration>): this {
    this._config = config;
    return this;
  }

  public build(): IStabilityPerformanceEngine {
    if (!this._context) {
      throw new StabilityValidationException("Context is required to build StabilityPerformanceEngine.");
    }

    return new StabilityPerformanceEngine(this._context, this._config);
  }
}
