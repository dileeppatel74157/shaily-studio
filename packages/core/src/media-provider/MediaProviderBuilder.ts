import { IMediaProviderEngine } from "./interfaces";
import { MediaProviderEngine } from "./MediaProviderEngine";
import { ProviderConfiguration } from "./models";
import { InvalidMediaRequestException } from "./types";

/**
 * Fluent builder for MediaProviderEngine.
 *
 * @example
 * ```ts
 * const mediaEngine = new MediaProviderBuilder()
 *   .withContext(ctx)
 *   .withProvider({
 *      provider: MediaProviderType.OPENAI,
 *      apiKey: "sk-...",
 *      capabilities: { ... }
 *   })
 *   .build();
 * ```
 */
export class MediaProviderBuilder {
  private _context?: any;
  private readonly _providers: ProviderConfiguration[] = [];

  public withContext(context: any): this {
    this._context = context;
    return this;
  }

  public withProvider(config: ProviderConfiguration): this {
    this._providers.push(config);
    return this;
  }

  public build(): IMediaProviderEngine {
    if (!this._context) {
      throw new InvalidMediaRequestException("Context is required to build MediaProviderEngine.");
    }

    const engine = new MediaProviderEngine(this._context);

    // Register all configured providers
    for (const config of this._providers) {
      engine.getProviderManager().registerProvider(config);
    }

    return engine;
  }
}
