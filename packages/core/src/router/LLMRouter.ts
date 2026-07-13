import { ILLMRouter } from "./ILLMRouter";
import { RouterRequest } from "./RouterRequest";
import { RouterResponse } from "./RouterResponse";
import { RouterSnapshot } from "./RouterSnapshot";
import { ModelDescriptor } from "./ModelDescriptor";
import { RouterContext } from "./RouterContext";
import { ModelRegistry } from "./ModelRegistry";
import { RoutingPolicy } from "./RoutingPolicy";
import { RouterValidator } from "./RouterValidator";

export class LLMRouter implements ILLMRouter {
  private readonly _modelRegistry = new ModelRegistry();
  private readonly _policy = new RoutingPolicy();
  private readonly _validator = new RouterValidator();

  constructor(public readonly context: RouterContext) {}

  public registerModel(model: ModelDescriptor): void {
    this._validator.validateModel(model);
    this._modelRegistry.register(model);
  }

  public unregisterModel(modelId: string): boolean {
    return this._modelRegistry.unregister(modelId);
  }

  public get policy(): RoutingPolicy {
    return this._policy;
  }

  public async route(request: RouterRequest): Promise<RouterResponse> {
    this._validator.validateRequest(request);
    this.context.logger.info("Routing LLM request...");

    const startTime = Date.now();
    const models = this._modelRegistry.list();

    // Select Strategy
    const strategy = this._policy.selectStrategy(request);
    this.context.logger.info(`Selected routing strategy: ${strategy.name}`);

    // Select Model
    const model = strategy.select(models, request);
    if (!model) {
      throw new Error(`No matching model found for request using strategy: ${strategy.name}`);
    }

    // Check cost & latency limits
    if (request.maxCost !== undefined) {
      const cost = model.costMetadata.inputCostPer1K + model.costMetadata.outputCostPer1K;
      if (cost > request.maxCost) {
        throw new Error(
          `Selected model ${model.id} cost ${cost} exceeds limit of ${request.maxCost}`
        );
      }
    }

    if (
      request.maxLatency !== undefined &&
      model.latencyMetadata.averageLatencyMs > request.maxLatency
    ) {
      throw new Error(
        `Selected model ${model.id} average latency ${model.latencyMetadata.averageLatencyMs}ms exceeds limit of ${request.maxLatency}ms`
      );
    }

    // Resolve Provider
    const provider = this.context.providerRegistry.get(model.providerId);
    if (!provider) {
      throw new Error(
        `Provider ${model.providerId} for model ${model.id} not found in provider registry.`
      );
    }

    // Initialize provider if needed
    if (provider.state === "CREATED") {
      await provider.initialize();
    }

    // Map request to ProviderRequest
    const providerRequest = {
      prompt: request.prompt,
      messages: request.messages,
      attachments: request.attachments,
      temperature: request.metadata?.temperature as number | undefined,
      maxTokens: request.metadata?.maxTokens as number | undefined,
      metadata: request.metadata,
    };

    // Execute provider request
    const providerResponse = await provider.execute(providerRequest);
    const overallLatency = Date.now() - startTime;

    return {
      providerId: model.providerId,
      modelId: model.id,
      providerResponse,
      routingReason: `Routed using strategy: ${strategy.name}`,
      latency: overallLatency,
      metadata: {
        modelSelected: model.id,
        routingStrategy: strategy.name,
      },
    };
  }

  public snapshot(): RouterSnapshot {
    return Object.freeze({
      timestamp: new Date(),
      defaultStrategy: this._policy.defaultStrategy,
      registeredModelsCount: this._modelRegistry.list().length,
      models: Object.freeze(this._modelRegistry.list().map((m) => Object.freeze({ ...m }))),
    });
  }
}
