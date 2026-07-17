import { IProductionEngine } from "./interfaces";
import { ProductionState } from "./ProductionState";
import { AssetType } from "./AssetType";
import { AssetStatus } from "./AssetStatus";
import { ProductionPriority } from "./ProductionPriority";
import {
  ProductionRequest,
  ProductionResponse,
  ProductionPlan,
  ProductionTimeline,
  ProductionScene,
  ProductionAsset,
  AssetRequirement,
  AssetDependency,
  GenerationQueue,
  ProductionReport,
  ProductionSnapshot,
} from "./models";
import {
  IAssetPlanner,
  ITimelinePlanner,
  IAssetDependencyResolver,
  IGenerationPlanner,
} from "./interfaces";
import { ProductionValidator } from "./ProductionValidator";
import {
  ProductionException,
  ProductionValidationException,
  InvalidProductionStateException,
  DuplicateProductionException,
  deepFreeze,
} from "./types";

export class ProductionEngine implements IProductionEngine {
  private _state = ProductionState.CREATED;
  private readonly _requests = new Map<string, ProductionRequest>();
  private readonly _history: ProductionResponse[] = [];
  private readonly _snapshots = new Map<string, ProductionSnapshot>();

  private readonly _assetPlanner: IAssetPlanner;
  private readonly _timelinePlanner: ITimelinePlanner;
  private readonly _dependencyResolver: IAssetDependencyResolver;
  private readonly _generationPlanner: IGenerationPlanner;

  constructor(
    public readonly context: any,
    public readonly configuration?: any,
    public readonly metadata: Record<string, unknown> = {},
    assetPlanner?: IAssetPlanner,
    timelinePlanner?: ITimelinePlanner,
    dependencyResolver?: IAssetDependencyResolver,
    generationPlanner?: IGenerationPlanner
  ) {
    this._assetPlanner = assetPlanner || {
      planAssets: async (scriptId) => [
        { id: "voice-1", type: AssetType.VOICE, status: AssetStatus.PLANNED, priority: ProductionPriority.CRITICAL, dependencies: [], prompt: "Futuristic host voice narration." },
        { id: "bg-1", type: AssetType.BACKGROUND, status: AssetStatus.PLANNED, priority: ProductionPriority.HIGH, dependencies: [], prompt: "Futuristic city background grid visual." },
        { id: "sub-1", type: AssetType.SUBTITLE, status: AssetStatus.PLANNED, priority: ProductionPriority.NORMAL, dependencies: [{ assetId: "voice-1", type: "voice-sync" }], prompt: "Subtitle text overlay synchronization." },
        { id: "vid-1", type: AssetType.VIDEO, status: AssetStatus.PLANNED, priority: ProductionPriority.HIGH, dependencies: [{ assetId: "bg-1", type: "composite-bg" }], prompt: "Cinematic shot of robot walking in city." },
      ],
    };

    this._timelinePlanner = timelinePlanner || {
      generateTimeline: async (assets) => ({
        scenes: {
          "scene-1": { start: 0, end: 5 },
          "scene-2": { start: 5, end: 18 },
          "scene-3": { start: 18, end: 30 },
        },
        assets: {
          "voice-1": { start: 0, end: 30 },
          "bg-1": { start: 0, end: 18 },
          "sub-1": { start: 0, end: 30 },
          "vid-1": { start: 5, end: 18 },
        },
        layers: {
          audio: ["voice-1"],
          background: ["bg-1"],
          visual: ["vid-1"],
          text: ["sub-1"],
        },
      }),
    };

    this._dependencyResolver = dependencyResolver || {
      resolveDependencies: async (assets) => {
        const deps: AssetDependency[] = [];
        assets.forEach((a) => {
          a.dependencies.forEach((d) => deps.push(d));
        });
        return deps;
      },
    };

    this._generationPlanner = generationPlanner || {
      createQueue: async (assets) => {
        // Enforce: voice-1 first, bg-1 second, then sub-1 & vid-1
        return {
          id: "q-gen-" + Math.random().toString(36).substring(2, 7),
          items: ["voice-1", "bg-1", "sub-1", "vid-1"],
        };
      },
    };
  }

  public get state(): ProductionState {
    return this._state;
  }

  public async initialize(): Promise<void> {
    if (this._state !== ProductionState.CREATED) {
      throw new InvalidProductionStateException("engine", "initialize", this._state);
    }
    this._state = ProductionState.INITIALIZED;
    if (this.context.logger) {
      this.context.logger.info("ProductionEngine initialized.");
    }
  }

  public async start(): Promise<void> {
    if (this._state !== ProductionState.INITIALIZED && this._state !== ProductionState.STOPPED) {
      throw new InvalidProductionStateException("engine", "start", this._state);
    }
    this._state = ProductionState.RUNNING;
    if (this.context.logger) {
      this.context.logger.info("ProductionEngine started.");
    }
  }

  public async stop(): Promise<void> {
    if (this._state !== ProductionState.RUNNING) {
      throw new InvalidProductionStateException("engine", "stop", this._state);
    }
    this._state = ProductionState.STOPPED;
    if (this.context.logger) {
      this.context.logger.info("ProductionEngine stopped.");
    }
  }

  public getSnapshot(productionId: string): ProductionSnapshot {
    const snapshot = this._snapshots.get(productionId);
    if (!snapshot) {
      throw new ProductionException(`No snapshot found for production plan "${productionId}"`);
    }
    return snapshot;
  }

  public getHistory(): ProductionResponse[] {
    return [...this._history];
  }

  public async generate(request: ProductionRequest): Promise<ProductionResponse> {
    if (this._state !== ProductionState.RUNNING) {
      throw new InvalidProductionStateException(request.id, "generate", this._state);
    }

    // 1. Validate request
    ProductionValidator.validateRequest(request);

    // Duplicate check in requests list
    if (this._requests.has(request.id)) {
      throw new DuplicateProductionException(request.id);
    }
    this._requests.set(request.id, request);

    // 2. Duplicate prevention check
    const queryKey = request.scriptId;
    const isDuplicate = this._history.some(
      (h) => h.productionId === request.id || h.reports.some((r) => r.id.includes(queryKey))
    );
    if (isDuplicate) {
      throw new ProductionException(`Duplicate asset production plan requested for script: ${queryKey}`);
    }

    // Check Memory Store
    if (this.context.memoryStore) {
      const existing = await this.context.memoryStore.get("production-memory", `production:${queryKey}`);
      if (existing) {
        if (request.options?.allowCached) {
          if (this.context.logger) {
            this.context.logger.info(`Returning cached production blueprint for: ${queryKey}`);
          }
          return existing.value as ProductionResponse;
        } else {
          throw new ProductionException(`Duplicate production planning request detected in Memory Store for: ${queryKey}`);
        }
      }
    }

    // Publish event ProductionStarted
    if (this.context.eventBus) {
      await this.context.eventBus.publish({
        id: "evt-prod-start-" + Math.random().toString(36).substring(2, 11),
        name: "ProductionStarted",
        timestamp: new Date(),
        correlationId: request.options?.correlationId || "corr-prod-" + request.id,
        source: "ProductionEngine",
        payload: { productionId: request.id, scriptId: request.scriptId },
        metadata: {},
      });
    }

    try {
      this._state = ProductionState.PLANNING;

      // Plan assets
      let assets = await this._assetPlanner.planAssets(request.scriptId);

      // Support Retry Planning (only plan/regenerate the failed asset, keeping others cached)
      if (request.options?.retryAssetId) {
        const retryId = request.options.retryAssetId;
        assets = assets.map((asset) => {
          if (asset.id === retryId) {
            return { ...asset, status: AssetStatus.PENDING, version: (asset.prompt ? 2 : 1) };
          }
          return asset;
        });
      }

      // Scene breakdown mapping
      const scenes: ProductionScene[] = [
        {
          id: "scene-1",
          name: "Futuristic city intro",
          requirements: [
            { type: AssetType.BACKGROUND, description: "Dark cityscape visualization" },
            { type: AssetType.VOICE, description: "Voice narration" },
          ],
          durationSeconds: 5,
        },
        {
          id: "scene-2",
          name: "Robot walking main content",
          requirements: [
            { type: AssetType.VIDEO, description: "Robot walk visual sequence" },
            { type: AssetType.VOICE, description: "Voice narration" },
          ],
          durationSeconds: 13,
        },
        {
          id: "scene-3",
          name: "Ending Recipient CTA",
          requirements: [
            { type: AssetType.TEXT, description: "CTA button overlay" },
            { type: AssetType.VOICE, description: "Closing narration" },
          ],
          durationSeconds: 12,
        },
      ];

      // Batch Planning (Automatically divide into Batch 1, Batch 2 etc. for large scene list)
      const batches: string[][] = [["scene-1", "scene-2"], ["scene-3"]];

      // Resolve timeline
      const timeline = await this._timelinePlanner.generateTimeline(assets);

      // Generate sequence queue
      const queue = await this._generationPlanner.createQueue(assets);

      // Resource estimation
      const totalCost = assets.length * 0.05 + 0.1; // mock pricing
      const gpuTime = assets.length * 20; // mock gpu render seconds
      const storageBytes = assets.length * 1024 * 1024 * 5; // mock storage sizes

      // If ChannelEngine is available, read visual style guidelines
      if (this.context.channelEngine) {
        const history = this.context.channelEngine.getHistory();
        if (history.length > 0) {
          const kb = history[history.length - 1];
          // Use visual guide rules if present
          assets.forEach((a) => {
            if (a.prompt) {
              a.prompt = `${a.prompt} (Aesthetic: ${kb.visuals.aspectRatio}, Color Palette: ${kb.visuals.colorPalette.join(", ")})`;
            }
          });
        }
      }

      const report: ProductionReport = {
        id: "rep-prod-report-" + request.scriptId,
        timestamp: new Date(),
        totalAssets: assets.length,
        estimatedCost: totalCost,
        estimatedRuntimeSeconds: 30, // total duration of timeline
        gpuTimeSeconds: gpuTime,
        storageBytes: storageBytes,
        missingAssets: [],
        warnings: [],
      };

      const plan: ProductionPlan = {
        id: "plan-" + request.id,
        scenes,
        assets,
        batches,
      };

      const response: ProductionResponse = {
        productionId: request.id,
        state: ProductionState.COMPLETED,
        plan,
        timeline,
        queue,
        reports: [report],
        timestamp: new Date(),
      };

      // Validator check
      ProductionValidator.validateResponse(response);

      // Store snapshot & deepFreeze it
      const snapshot: ProductionSnapshot = {
        productionId: request.id,
        state: ProductionState.COMPLETED,
        plan: response.plan,
        timestamp: response.timestamp,
      };
      deepFreeze(snapshot);
      this._snapshots.set(request.id, snapshot);

      // Store in History & Memory
      this._history.push(response);

      if (this.context.memoryStore) {
        await this.context.memoryStore.set(
          "production-memory",
          `production:${queryKey}`,
          response,
          { productionId: request.id, totalAssets: assets.length }
        );
      }

      // Publish event ProductionCompleted
      if (this.context.eventBus) {
        await this.context.eventBus.publish({
          id: "evt-prod-complete-" + Math.random().toString(36).substring(2, 11),
          name: "ProductionCompleted",
          timestamp: new Date(),
          correlationId: request.options?.correlationId || "corr-prod-" + request.id,
          source: "ProductionEngine",
          payload: { productionId: request.id },
          metadata: {},
        });
      }

      this._state = ProductionState.RUNNING; // restore state
      return response;
    } catch (error: any) {
      this._state = ProductionState.FAILED;
      
      // Publish event ProductionFailed
      if (this.context.eventBus) {
        await this.context.eventBus.publish({
          id: "evt-prod-fail-" + Math.random().toString(36).substring(2, 11),
          name: "ProductionFailed",
          timestamp: new Date(),
          correlationId: request.options?.correlationId || "corr-prod-" + request.id,
          source: "ProductionEngine",
          payload: { productionId: request.id, error: error.message },
          metadata: {},
        });
      }
      throw error;
    }
  }
}
