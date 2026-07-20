import { ISocialPlatformEngine } from "./interfaces";
import { SocialPlatformEngine } from "./SocialPlatformEngine";
import { ValidationException } from "./types";

/**
 * Fluent builder for SocialPlatformEngine.
 *
 * @example
 * ```ts
 * const engine = new SocialPlatformBuilder()
 *   .withContext(context)
 *   .build();
 * ```
 */
export class SocialPlatformBuilder {
  private _context?: any;

  public withContext(context: any): this {
    this._context = context;
    return this;
  }

  public build(): ISocialPlatformEngine {
    if (!this._context) {
      throw new ValidationException("Context is required to build SocialPlatformEngine.");
    }
    return new SocialPlatformEngine(this._context);
  }
}
