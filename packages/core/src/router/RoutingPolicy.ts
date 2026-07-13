import { RoutingStrategy } from "./RoutingStrategy";
import { RouterRequest } from "./RouterRequest";
import {
  FirstAvailableStrategy,
  LowestCostStrategy,
  LowestLatencyStrategy,
  CapabilityMatchStrategy,
  PreferredProviderStrategy,
  PreferredModelStrategy,
} from "./RoutingStrategy";

export class RoutingPolicy {
  private _strategies = new Map<string, RoutingStrategy>();
  private _defaultStrategy = "FIRST_AVAILABLE";

  constructor() {
    this.registerStrategy(new FirstAvailableStrategy());
    this.registerStrategy(new LowestCostStrategy());
    this.registerStrategy(new LowestLatencyStrategy());
    this.registerStrategy(new CapabilityMatchStrategy());
    this.registerStrategy(new PreferredProviderStrategy());
    this.registerStrategy(new PreferredModelStrategy());
  }

  public get defaultStrategy(): string {
    return this._defaultStrategy;
  }

  public registerStrategy(strategy: RoutingStrategy): void {
    this._strategies.set(strategy.name, strategy);
  }

  public selectStrategy(request: RouterRequest): RoutingStrategy {
    if (request.preferredModel) {
      return this._strategies.get("PREFERRED_MODEL")!;
    }
    if (request.preferredProvider) {
      return this._strategies.get("PREFERRED_PROVIDER")!;
    }
    if (request.requiredCapabilities) {
      return this._strategies.get("CAPABILITY_MATCH")!;
    }
    return this._strategies.get(this._defaultStrategy)!;
  }

  public setDefaultStrategy(name: string): void {
    if (!this._strategies.has(name)) {
      throw new Error(`Strategy ${name} is not registered.`);
    }
    this._defaultStrategy = name;
  }
}
