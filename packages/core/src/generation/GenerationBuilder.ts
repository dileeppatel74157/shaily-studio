import { GenerationEngine } from "./GenerationEngine";
import {
  IProviderRouter,
  IAssetGenerator,
  IQueueExecutor,
  IDependencyResolver,
  IVersionManager,
} from "./interfaces";
import { ProviderCapability } from "./models";

export class GenerationBuilder {
  private _context?: any;
  private _configuration?: any;
  private _metadata: Record<string, unknown> = {};
  private _capabilities?: ProviderCapability[];
  private _providerRouter?: IProviderRouter;
  private _assetGenerator?: IAssetGenerator;
  private _queueExecutor?: IQueueExecutor;
  private _dependencyResolver?: IDependencyResolver;
  private _versionManager?: IVersionManager;

  public withContext(context: any): this {
    this._context = context;
    return this;
  }

  public withConfiguration(configuration: any): this {
    this._configuration = configuration;
    return this;
  }

  public withMetadata(metadata: Record<string, unknown>): this {
    this._metadata = { ...metadata };
    return this;
  }

  public withCapabilities(capabilities: ProviderCapability[]): this {
    this._capabilities = capabilities;
    return this;
  }

  public withProviderRouter(router: IProviderRouter): this {
    this._providerRouter = router;
    return this;
  }

  public withAssetGenerator(generator: IAssetGenerator): this {
    this._assetGenerator = generator;
    return this;
  }

  public withQueueExecutor(executor: IQueueExecutor): this {
    this._queueExecutor = executor;
    return this;
  }

  public withDependencyResolver(resolver: IDependencyResolver): this {
    this._dependencyResolver = resolver;
    return this;
  }

  public withVersionManager(manager: IVersionManager): this {
    this._versionManager = manager;
    return this;
  }

  public build(): GenerationEngine {
    if (!this._context) {
      throw new Error("Context is required to build a GenerationEngine.");
    }
    return new GenerationEngine(
      this._context,
      this._configuration,
      this._metadata,
      this._capabilities,
      this._providerRouter,
      this._assetGenerator,
      this._queueExecutor,
      this._dependencyResolver,
      this._versionManager
    );
  }
}
