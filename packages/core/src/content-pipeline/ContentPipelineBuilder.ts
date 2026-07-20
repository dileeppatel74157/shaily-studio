import { IContentPipelineEngine } from "./interfaces";
import { ContentPipelineEngine } from "./ContentPipelineEngine";
import { ValidationException } from "./types";

/**
 * Fluent builder for ContentPipelineEngine.
 *
 * @example
 * ```ts
 * const engine = new ContentPipelineBuilder()
 *   .withContext(context)
 *   .build();
 * ```
 */
export class ContentPipelineBuilder {
  private _context?: any;

  public withContext(context: any): this {
    this._context = context;
    return this;
  }

  public build(): IContentPipelineEngine {
    if (!this._context) {
      throw new ValidationException("Context is required to build ContentPipelineEngine.");
    }
    return new ContentPipelineEngine(this._context);
  }
}
