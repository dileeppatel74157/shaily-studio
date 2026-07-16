import { ILLMRouter } from "./ILLMRouter";
import { RouterRequest } from "./RouterRequest";
import { RouterResponse } from "./RouterResponse";
import { RouterSnapshot } from "./RouterSnapshot";
import { ModelDescriptor } from "./ModelDescriptor";
import { RouterContext } from "./RouterContext";
import { ModelRegistry } from "./ModelRegistry";
import { RoutingPolicy } from "./RoutingPolicy";
import { RouterValidator } from "./RouterValidator";
import { ProviderState } from "../providers/ProviderState";
import { ProviderResponseChunk } from "../providers/ProviderResponse";

export class LLMRouter implements ILLMRouter {
  private readonly _modelRegistry = new ModelRegistry();
  private readonly _policy = new RoutingPolicy();
  private readonly _validator = new RouterValidator();

  private readonly _failedStreak = new Map<string, number>();
  private readonly _cooldownUntil = new Map<string, number>();
  private _lastSelectedModelId?: string;
  private _roundRobinIndex = 0;

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

  public selectCandidates(
    models: readonly ModelDescriptor[],
    request: RouterRequest
  ): ModelDescriptor[] {
    return models.filter((m) => {
      if (!m.enabled) return false;

      // 1. Capability Filtering
      if (request.requiredCapabilities) {
        for (const [cap, reqVal] of Object.entries(request.requiredCapabilities)) {
          if (reqVal) {
            const supportsCap = (m.capabilities as any)[cap] === true || (m as any)[cap] === true;
            if (!supportsCap) return false;
          }
        }
      }

      // V2 explicit requirements
      if (request.metadata?.stream && m.streaming === false) return false;
      if (request.metadata?.vision && m.vision === false) return false;
      if (request.metadata?.embeddings && m.embeddings === false) return false;
      if (request.metadata?.tools && m.tools === false) return false;
      if (request.metadata?.JSON && m.JSON === false) return false;

      // 2. Health & Blacklist Filtering
      const pId = m.providerId;
      const cooldownTime = this._cooldownUntil.get(pId) || 0;
      if (cooldownTime > Date.now()) {
        return false;
      }
      const streak = this._failedStreak.get(pId) || 0;
      if (streak >= 3) {
        return false;
      }

      return true;
    });
  }

  private sortCandidates(candidates: ModelDescriptor[], strategyName: string, request: RouterRequest): ModelDescriptor[] {
    let sorted = [...candidates];
    if (strategyName === "LOWEST_COST") {
      sorted.sort((a, b) => {
        const costA = a.costMetadata.inputCostPer1K + a.costMetadata.outputCostPer1K;
        const costB = b.costMetadata.inputCostPer1K + b.costMetadata.outputCostPer1K;
        return costA - costB;
      });
    } else if (strategyName === "LOWEST_LATENCY") {
      sorted.sort((a, b) => a.latencyMetadata.averageLatencyMs - b.latencyMetadata.averageLatencyMs);
    } else if (strategyName === "ROUND_ROBIN") {
      const idx = this._roundRobinIndex++ % sorted.length;
      sorted = [...sorted.slice(idx), ...sorted.slice(0, idx)];
    } else if (strategyName === "STICKY") {
      if (this._lastSelectedModelId) {
        const stickyIdx = sorted.findIndex((c) => c.id === this._lastSelectedModelId);
        if (stickyIdx > 0) {
          sorted = [sorted[stickyIdx], ...sorted.filter((c) => c.id !== this._lastSelectedModelId)];
        }
      }
    } else if (strategyName === "PREFERRED_PROVIDER" && request.preferredProvider) {
      sorted.sort((a, b) => {
        if (a.providerId === request.preferredProvider && b.providerId !== request.preferredProvider) return -1;
        if (a.providerId !== request.preferredProvider && b.providerId === request.preferredProvider) return 1;
        return 0;
      });
    } else if (strategyName === "PREFERRED_MODEL" && request.preferredModel) {
      sorted.sort((a, b) => {
        if (a.id === request.preferredModel && b.id !== request.preferredModel) return -1;
        if (a.id !== request.preferredModel && b.id === request.preferredModel) return 1;
        return 0;
      });
    } else if (strategyName === "WEIGHTED") {
      let totalWeight = 0;
      const weights = sorted.map((c) => {
        const w = (c.providerMetadata?.weight as number) || 1;
        totalWeight += w;
        return w;
      });
      let rand = Math.random() * totalWeight;
      let selectedIdx = 0;
      for (let i = 0; i < weights.length; i++) {
        rand -= weights[i];
        if (rand <= 0) {
          selectedIdx = i;
          break;
        }
      }
      sorted = [sorted[selectedIdx], ...sorted.filter((_, idx) => idx !== selectedIdx)];
    }
    return sorted;
  }

  public async route(request: RouterRequest): Promise<RouterResponse> {
    this._validator.validateRequest(request);
    this.context.logger.info("Routing LLM request via Router V2...");

    const startTime = Date.now();
    const models = [
      ...this._modelRegistry.list(),
      ...this.context.providerRegistry.list().flatMap((p) => p.models || []),
    ];

    const strategyName = request.routingStrategy || this._policy.defaultStrategy;
    let candidates = this.selectCandidates(models, request);

    if (candidates.length === 0) {
      candidates = models.filter((m) => m.enabled);
    }

    if (candidates.length === 0) {
      throw new Error(`No enabled candidate models found for routing.`);
    }

    candidates = this.sortCandidates(candidates, strategyName, request);

    // Build fallback chain description
    const fallbackChain: string[] = [];
    for (let i = 1; i < candidates.length; i++) {
      fallbackChain.push(candidates[i].id);
    }

    let lastError: Error | null = null;
    for (const model of candidates) {
      const provider = this.context.providerRegistry.get(model.providerId);
      if (!provider) {
        continue;
      }

      try {
        if (provider.state === ProviderState.CREATED) {
          await provider.initialize();
        }
        if (provider.state === ProviderState.READY) {
          await provider.start();
        }

        const providerRequest = {
          requestId: `req-${Date.now()}`,
          providerId: provider.id,
          model: model.id,
          prompt: request.prompt,
          messages: request.messages,
          attachments: request.attachments,
          temperature: request.metadata?.temperature as number | undefined,
          maxTokens: request.metadata?.maxTokens as number | undefined,
          metadata: request.metadata,
        };

        const providerResponse = await provider.execute(providerRequest);
        const overallLatency = Date.now() - startTime;

        // Reset streak on success
        this._failedStreak.set(provider.id, 0);
        this._cooldownUntil.delete(provider.id);
        this._lastSelectedModelId = model.id;

        return {
          providerId: model.providerId,
          modelId: model.id,
          providerResponse,
          routingReason: `Routed using strategy: ${strategyName}`,
          latency: overallLatency,
          metadata: {
            modelSelected: model.id,
            routingStrategy: strategyName,
            fallbackChain,
          },
        };
      } catch (err: any) {
        this.context.logger.warn(`Routing execution failed on model "${model.id}": ${err.message}. Retrying on fallback...`);
        lastError = err;

        // Record failure
        const streak = (this._failedStreak.get(provider.id) || 0) + 1;
        this._failedStreak.set(provider.id, streak);
        this._cooldownUntil.set(provider.id, Date.now() + 30000); // 30s cooldown
        this.context.providerRegistry.notifyHealthUpdate(provider.id, provider.health());
      }
    }

    throw new Error(`All candidate models failed. Last error: ${lastError?.message}`);
  }

  public async *routeStream(request: RouterRequest): AsyncGenerator<ProviderResponseChunk> {
    this._validator.validateRequest(request);
    this.context.logger.info("Routing streaming LLM request via Router V2...");

    const models = [
      ...this._modelRegistry.list(),
      ...this.context.providerRegistry.list().flatMap((p) => p.models || []),
    ];

    const strategyName = request.routingStrategy || this._policy.defaultStrategy;
    let candidates = this.selectCandidates(models, request);

    if (candidates.length === 0) {
      candidates = models.filter((m) => m.enabled);
    }

    if (candidates.length === 0) {
      throw new Error(`No enabled candidate models found for streaming routing.`);
    }

    candidates = this.sortCandidates(candidates, strategyName, request);

    let lastError: Error | null = null;
    for (const model of candidates) {
      const provider = this.context.providerRegistry.get(model.providerId);
      if (!provider) {
        continue;
      }

      try {
        if (provider.state === ProviderState.CREATED) {
          await provider.initialize();
        }
        if (provider.state === ProviderState.READY) {
          await provider.start();
        }

        const providerRequest = {
          requestId: `req-${Date.now()}`,
          providerId: provider.id,
          model: model.id,
          prompt: request.prompt,
          messages: request.messages,
          attachments: request.attachments,
          temperature: request.metadata?.temperature as number | undefined,
          maxTokens: request.metadata?.maxTokens as number | undefined,
          metadata: request.metadata,
          stream: true,
        };

        const streamGen = provider.stream(providerRequest);
        for await (const chunk of streamGen) {
          yield chunk;
        }

        this._failedStreak.set(provider.id, 0);
        this._cooldownUntil.delete(provider.id);
        this._lastSelectedModelId = model.id;
        return;
      } catch (err: any) {
        this.context.logger.warn(`Streaming routing failed on model "${model.id}": ${err.message}. Retrying on fallback...`);
        lastError = err;

        const streak = (this._failedStreak.get(provider.id) || 0) + 1;
        this._failedStreak.set(provider.id, streak);
        this._cooldownUntil.set(provider.id, Date.now() + 30000);
        this.context.providerRegistry.notifyHealthUpdate(provider.id, provider.health());
      }
    }

    throw new Error(`All candidate models failed during streaming. Last error: ${lastError?.message}`);
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
