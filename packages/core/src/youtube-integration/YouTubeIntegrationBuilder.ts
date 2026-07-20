import { IYouTubeIntegrationEngine } from "./interfaces";
import { YouTubeIntegrationEngine } from "./YouTubeIntegrationEngine";
import { ValidationException } from "./types";

/**
 * Fluent builder for YouTubeIntegrationEngine.
 *
 * @example
 * ```ts
 * const engine = new YouTubeIntegrationBuilder()
 *   .withContext(context)
 *   .build();
 * ```
 */
export class YouTubeIntegrationBuilder {
  private _context?: any;

  public withContext(context: any): this {
    this._context = context;
    return this;
  }

  public build(): IYouTubeIntegrationEngine {
    if (!this._context) {
      throw new ValidationException("Context is required to build YouTubeIntegrationEngine.");
    }
    return new YouTubeIntegrationEngine(this._context);
  }
}
