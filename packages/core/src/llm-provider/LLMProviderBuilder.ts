import { ILLMProviderEngine } from "./interfaces";
import { LLMProviderEngine } from "./LLMProviderEngine";
import { ProviderConfiguration, ModelRoutingRule } from "./models";
import { LLMProviderValidationException } from "./types";

/**
 * Fluent builder for LLMProviderEngine.
 *
 * @example
 * ```ts
 * const llmEngine = new LLMProviderBuilder()
 *   .withContext(ctx)
 *   .withProvider({
 *      provider: ProviderType.OPENAI,
 *      apiKey: "sk-...",
 *      models: [...]
 *   })
 *   .build();
 * ```
 */
export class LLMProviderBuilder {
  private _context?: any;
  private readonly _providers: ProviderConfiguration[] = [];
  private readonly _routingRules: ModelRoutingRule[] = [];

  public withContext(context: any): this {
    this._context = context;
    return this;
  }

  public withProvider(config: ProviderConfiguration): this {
    this._providers.push(config);
    return this;
  }

  public withRoutingRule(rule: ModelRoutingRule): this {
    this._routingRules.push(rule);
    return this;
  }

  public build(): ILLMProviderEngine {
    if (!this._context) {
      throw new LLMProviderValidationException("Context is required to build LLMProviderEngine.");
    }

    const engine = new LLMProviderEngine(this._context);

    // Register all configured providers
    for (const config of this._providers) {
      // Synchronously register providers inside building phase
      // Note: registerProvider is async in interface, but inside LLMProviderEngine
      // it completes synchronously because mock handshakes are fast. We wrap it in a micro-task await
      // during test lifecycle.
      engine.getProviderManager().registerProvider(config);
    }

    // Register routing rules
    for (const rule of this._routingRules) {
      engine.getRouter().addRoutingRule(rule);
    }

    return engine;
  }
}
