import { ModelDescriptor } from "./ModelDescriptor";
import { RouterRequest } from "./RouterRequest";

export interface RoutingStrategy {
  select(
    models: ReadonlyArray<ModelDescriptor>,
    request: RouterRequest
  ): ModelDescriptor | undefined;
  readonly name: string;
}

export class FirstAvailableStrategy implements RoutingStrategy {
  public readonly name = "FIRST_AVAILABLE";

  public select(
    models: ReadonlyArray<ModelDescriptor>,
    _request: RouterRequest
  ): ModelDescriptor | undefined {
    return models.find((m) => m.enabled);
  }
}

export class LowestCostStrategy implements RoutingStrategy {
  public readonly name = "LOWEST_COST";

  public select(
    models: ReadonlyArray<ModelDescriptor>,
    _request: RouterRequest
  ): ModelDescriptor | undefined {
    let bestModel: ModelDescriptor | undefined;
    let minCost = Infinity;

    for (const m of models) {
      if (m.enabled) {
        const cost = m.costMetadata.inputCostPer1K + m.costMetadata.outputCostPer1K;
        if (cost < minCost) {
          minCost = cost;
          bestModel = m;
        }
      }
    }
    return bestModel;
  }
}

export class LowestLatencyStrategy implements RoutingStrategy {
  public readonly name = "LOWEST_LATENCY";

  public select(
    models: ReadonlyArray<ModelDescriptor>,
    _request: RouterRequest
  ): ModelDescriptor | undefined {
    let bestModel: ModelDescriptor | undefined;
    let minLatency = Infinity;

    for (const m of models) {
      if (m.enabled) {
        const lat = m.latencyMetadata.averageLatencyMs;
        if (lat < minLatency) {
          minLatency = lat;
          bestModel = m;
        }
      }
    }
    return bestModel;
  }
}

export class CapabilityMatchStrategy implements RoutingStrategy {
  public readonly name = "CAPABILITY_MATCH";

  public select(
    models: ReadonlyArray<ModelDescriptor>,
    request: RouterRequest
  ): ModelDescriptor | undefined {
    const reqCaps = request.requiredCapabilities;
    if (!reqCaps) {
      return models.find((m) => m.enabled);
    }

    return models.find((m) => {
      if (!m.enabled) return false;
      for (const [capKey, reqVal] of Object.entries(reqCaps)) {
        if (reqVal === true && (m.capabilities as any)[capKey] !== true) {
          return false;
        }
      }
      return true;
    });
  }
}

export class PreferredProviderStrategy implements RoutingStrategy {
  public readonly name = "PREFERRED_PROVIDER";

  public select(
    models: ReadonlyArray<ModelDescriptor>,
    request: RouterRequest
  ): ModelDescriptor | undefined {
    const pref = request.preferredProvider;
    if (!pref) return undefined;

    const match = models.find((m) => m.enabled && m.providerId === pref);
    return match || models.find((m) => m.enabled);
  }
}

export class PreferredModelStrategy implements RoutingStrategy {
  public readonly name = "PREFERRED_MODEL";

  public select(
    models: ReadonlyArray<ModelDescriptor>,
    request: RouterRequest
  ): ModelDescriptor | undefined {
    const pref = request.preferredModel;
    if (!pref) return undefined;

    const match = models.find((m) => m.enabled && m.id === pref);
    return match || models.find((m) => m.enabled);
  }
}
