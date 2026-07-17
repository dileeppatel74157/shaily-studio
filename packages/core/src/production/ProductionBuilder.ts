import { ProductionEngine } from "./ProductionEngine";
import {
  IAssetPlanner,
  ITimelinePlanner,
  IAssetDependencyResolver,
  IGenerationPlanner,
} from "./interfaces";

export class ProductionBuilder {
  private _context?: any;
  private _configuration?: any;
  private _metadata: Record<string, unknown> = {};
  private _assetPlanner?: IAssetPlanner;
  private _timelinePlanner?: ITimelinePlanner;
  private _dependencyResolver?: IAssetDependencyResolver;
  private _generationPlanner?: IGenerationPlanner;

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

  public withAssetPlanner(planner: IAssetPlanner): this {
    this._assetPlanner = planner;
    return this;
  }

  public withTimelinePlanner(planner: ITimelinePlanner): this {
    this._timelinePlanner = planner;
    return this;
  }

  public withDependencyResolver(resolver: IAssetDependencyResolver): this {
    this._dependencyResolver = resolver;
    return this;
  }

  public withGenerationPlanner(planner: IGenerationPlanner): this {
    this._generationPlanner = planner;
    return this;
  }

  public build(): ProductionEngine {
    if (!this._context) {
      throw new Error("Context is required to build a ProductionEngine.");
    }
    return new ProductionEngine(
      this._context,
      this._configuration,
      this._metadata,
      this._assetPlanner,
      this._timelinePlanner,
      this._dependencyResolver,
      this._generationPlanner
    );
  }
}
