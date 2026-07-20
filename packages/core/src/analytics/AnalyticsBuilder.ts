import { IAnalyticsEngine } from "./interfaces";
import { AnalyticsEngine } from "./AnalyticsEngine";
import { ValidationException } from "./types";

/**
 * Fluent builder for AnalyticsEngine.
 *
 * @example
 * ```ts
 * const engine = new AnalyticsBuilder()
 *   .withContext(context)
 *   .build();
 * ```
 */
export class AnalyticsBuilder {
  private _context?: any;

  public withContext(context: any): this {
    this._context = context;
    return this;
  }

  public build(): IAnalyticsEngine {
    if (!this._context) {
      throw new ValidationException("Context is required to build AnalyticsEngine.");
    }
    return new AnalyticsEngine(this._context);
  }
}
