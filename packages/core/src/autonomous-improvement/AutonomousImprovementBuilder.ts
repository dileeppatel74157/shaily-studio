import { IAutonomousImprovementEngine } from "./interfaces";
import { AutonomousImprovementEngine } from "./AutonomousImprovementEngine";
import { ValidationException } from "./types";

/**
 * Fluent builder for AutonomousImprovementEngine.
 *
 * @example
 * ```ts
 * const engine = new AutonomousImprovementBuilder()
 *   .withContext(context)
 *   .build();
 * ```
 */
export class AutonomousImprovementBuilder {
  private _context?: any;

  public withContext(context: any): this {
    this._context = context;
    return this;
  }

  public build(): IAutonomousImprovementEngine {
    if (!this._context) {
      throw new ValidationException("Context is required to build AutonomousImprovementEngine.");
    }
    return new AutonomousImprovementEngine(this._context);
  }
}
