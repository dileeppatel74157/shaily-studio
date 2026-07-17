import {
  ProductionRequest,
  ProductionResponse,
  ProductionSnapshot,
  ProductionAsset,
  ProductionTimeline,
  AssetDependency,
  GenerationQueue,
} from "./models";

export interface IProductionEngine {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  generate(request: ProductionRequest): Promise<ProductionResponse>;
  getSnapshot(productionId: string): ProductionSnapshot;
  getHistory(): ProductionResponse[];
}

export interface IAssetPlanner {
  planAssets(scriptId: string): Promise<ProductionAsset[]>;
}

export interface ITimelinePlanner {
  generateTimeline(assets: ProductionAsset[]): Promise<ProductionTimeline>;
}

export interface IAssetDependencyResolver {
  resolveDependencies(assets: ProductionAsset[]): Promise<AssetDependency[]>;
}

export interface IGenerationPlanner {
  createQueue(assets: ProductionAsset[]): Promise<GenerationQueue>;
}
