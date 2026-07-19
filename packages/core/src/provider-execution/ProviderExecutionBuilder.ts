import { IProviderExecutionEngine } from "./interfaces";
import { ProviderExecutionEngine } from "./ProviderExecutionEngine";
import { ExecutionValidationException } from "./types";
import { ExecutionConfiguration } from "./models";
import { SelectionStrategy } from "./SelectionStrategy";
import { ExecutionMode } from "./ExecutionMode";

export class ProviderExecutionBuilder {
  private _context?: any;
  private _config?: Partial<ExecutionConfiguration>;
  private _gateway?: any;

  public withContext(context: any): this {
    this._context = context;
    return this;
  }

  public withConfig(config: Partial<ExecutionConfiguration>): this {
    this._config = config;
    return this;
  }

  public withGateway(gateway: any): this {
    this._gateway = gateway;
    return this;
  }

  public build(): IProviderExecutionEngine {
    if (!this._context) {
      throw new ExecutionValidationException("Context is required to build ProviderExecutionEngine.");
    }

    const defaultConfig: ExecutionConfiguration = {
      environment: "local",
      defaultStrategy: SelectionStrategy.BALANCED,
      defaultMode: ExecutionMode.SEQUENTIAL,
      dailyBudgetUsd: 10.0,
      monthlyBudgetUsd: 100.0,
      founderPreferredProviders: ["openai", "gemini"],
      enableSmartCache: true,
      enableQualityEvaluation: true,
      enableBudgetProtection: true,
      cacheMaxSizeMb: 256,
      cacheTtlSeconds: 3600,
      emergencyStopThresholdUsd: 50.0,
      maxParallelRequests: 5,
      ...this._config
    };

    return new ProviderExecutionEngine(this._context, defaultConfig, this._gateway);
  }
}
