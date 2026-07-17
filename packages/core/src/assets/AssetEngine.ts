import { IAssetEngine } from "./interfaces";
import { AssetState } from "./AssetState";
import { AssetType } from "./AssetType";
import { PromptType } from "./PromptType";
import { MediaType } from "./MediaType";
import { VisualStyle } from "./VisualStyle";
import {
  AssetRequest,
  AssetResponse,
  ProductionAsset,
  AssetGroup,
  AssetPrompt,
  CharacterProfile,
  StyleGuide,
  MediaTimeline,
  DependencyGraph,
  ProductionReport,
  ProductionSnapshot,
} from "./models";
import {
  IPromptEngine,
  IStyleEngine,
  ICharacterEngine,
  ITimelinePlanner,
} from "./interfaces";
import { AssetValidator } from "./AssetValidator";
import {
  AssetException,
  AssetValidationException,
  InvalidAssetStateException,
  DuplicateAssetException,
  deepFreeze,
} from "./types";

export class AssetEngine implements IAssetEngine {
  private _state = AssetState.CREATED;
  private readonly _requests = new Map<string, AssetRequest>();
  private readonly _history: AssetResponse[] = [];
  private readonly _snapshots = new Map<string, ProductionSnapshot>();

  private readonly _promptEngine: IPromptEngine;
  private readonly _styleEngine: IStyleEngine;
  private readonly _characterEngine: ICharacterEngine;
  private readonly _timelinePlanner: ITimelinePlanner;

  constructor(
    public readonly context: any,
    public readonly configuration?: any,
    public readonly metadata: Record<string, unknown> = {},
    promptEngine?: IPromptEngine,
    styleEngine?: IStyleEngine,
    characterEngine?: ICharacterEngine,
    timelinePlanner?: ITimelinePlanner
  ) {
    this._promptEngine = promptEngine || {
      generatePrompts: async (asset) => [
        {
          type: PromptType.IMAGE_MODEL,
          promptText: `A high-quality image of ${asset.name}, dark mode styling, flat vector illustration.`,
          version: 1,
        },
      ],
    };

    this._styleEngine = styleEngine || {
      generateStyleGuide: async (niche) => ({
        visualStyle: VisualStyle.DARK_MODE,
        colorPalette: ["#1e1e2e", "#89b4fa"],
        lightingSpec: "Ambient neon backlighting",
        cameraLanguage: "Static medium shot with smooth slider pans.",
        compositionRules: ["Rule of thirds", "Code syntax centered"],
        lensSuggestions: ["50mm prime lens"],
        aspectRatio: "16:9",
        resolution: "3840x2160 (4K)",
        renderQuality: "Ultra High Quality",
      }),
    };

    this._characterEngine = characterEngine || {
      generateCharacterProfiles: async (niche) => [
        {
          id: "char-host",
          name: "Presenter Host",
          type: "AVATAR",
          visualSpec: "Male avatar, professional attire, dark hair.",
          voiceId: "voice-en-us-male-1",
        },
      ],
    };

    this._timelinePlanner = timelinePlanner || {
      generateTimeline: async (assets) => ({
        shots: ["Shot 1: Introduction presenter", "Shot 2: Screenshare compiler", "Shot 3: Recipient CTA"],
        assetTimings: {
          "asset-1": { start: 0, duration: 20 },
          "asset-2": { start: 20, duration: 30 },
          "asset-3": { start: 50, duration: 10 },
        },
        layerTimings: {
          background: ["bg-dark-grid"],
          presenter: ["char-host"],
        },
        transitionTimings: {
          "shot-1-2": "Slide Left",
          "shot-2-3": "Fade Black",
        },
        overlayTimings: {
          "text-overlay-1": { start: 2, duration: 8 },
        },
        subtitleTimings: {
          "subtitle-1": "0s - 20s: Welcome back to Shaily Studio.",
        },
      }),
    };
  }

  public get state(): AssetState {
    return this._state;
  }

  public async initialize(): Promise<void> {
    if (this._state !== AssetState.CREATED) {
      throw new InvalidAssetStateException("engine", "initialize", this._state);
    }
    this._state = AssetState.INITIALIZED;
    if (this.context.logger) {
      this.context.logger.info("AssetEngine initialized.");
    }
  }

  public async start(): Promise<void> {
    if (this._state !== AssetState.INITIALIZED && this._state !== AssetState.STOPPED) {
      throw new InvalidAssetStateException("engine", "start", this._state);
    }
    this._state = AssetState.RUNNING;
    if (this.context.logger) {
      this.context.logger.info("AssetEngine started.");
    }
  }

  public async stop(): Promise<void> {
    if (this._state !== AssetState.RUNNING) {
      throw new InvalidAssetStateException("engine", "stop", this._state);
    }
    this._state = AssetState.STOPPED;
    if (this.context.logger) {
      this.context.logger.info("AssetEngine stopped.");
    }
  }

  public getSnapshot(productionId: string): ProductionSnapshot {
    const snapshot = this._snapshots.get(productionId);
    if (!snapshot) {
      throw new AssetException(`No snapshot found for production plan "${productionId}"`);
    }
    return snapshot;
  }

  public getHistory(): AssetResponse[] {
    return [...this._history];
  }

  public async generate(request: AssetRequest): Promise<AssetResponse> {
    if (this._state !== AssetState.RUNNING) {
      throw new InvalidAssetStateException(request.id, "generate", this._state);
    }

    // 1. Validate request
    AssetValidator.validateRequest(request);

    // Duplicate check in requests list
    if (this._requests.has(request.id)) {
      throw new DuplicateAssetException(request.id);
    }
    this._requests.set(request.id, request);

    // 2. Duplicate prevention check
    const queryKey = request.scriptId;
    const isDuplicate = this._history.some(
      (h) => h.productionId === request.id || h.reports.some((r) => r.id.includes(queryKey))
    );
    if (isDuplicate) {
      throw new AssetException(`Duplicate asset production plan requested for script: ${queryKey}`);
    }

    // Check Memory Store
    if (this.context.memoryStore) {
      const existing = await this.context.memoryStore.get("asset-memory", `assets:${queryKey}`);
      if (existing) {
        if (request.options?.allowCached) {
          if (this.context.logger) {
            this.context.logger.info(`Returning cached production assets for: ${queryKey}`);
          }
          return existing.value as AssetResponse;
        } else {
          throw new AssetException(`Duplicate asset planning request detected in Memory Store for: ${queryKey}`);
        }
      }
    }

    // Publish event AssetPlanningStarted
    if (this.context.eventBus) {
      await this.context.eventBus.publish({
        id: "evt-asset-start-" + Math.random().toString(36).substring(2, 11),
        name: "AssetPlanningStarted",
        timestamp: new Date(),
        correlationId: request.options?.correlationId || "corr-assets-" + request.id,
        source: "AssetEngine",
        payload: { productionId: request.id, scriptId: request.scriptId },
        metadata: {},
      });
    }

    try {
      this._state = AssetState.ASSET_PLANNING;
      // Define baseline visual production assets
      const asset1: ProductionAsset = {
        id: "asset-1",
        type: AssetType.BACKGROUND,
        name: "Dark Tech Terminal Background",
        priority: "HIGH",
        version: 1,
        prompts: [],
        dependencies: [],
      };

      const asset2: ProductionAsset = {
        id: "asset-2",
        type: AssetType.IMAGE,
        name: "Fira Code Syntax Graphics screenshot",
        priority: "NORMAL",
        version: 1,
        prompts: [],
        dependencies: ["asset-1"],
      };

      const asset3: ProductionAsset = {
        id: "asset-3",
        type: AssetType.TEXT_OVERLAY,
        name: "CTA text layer",
        priority: "LOW",
        version: 1,
        prompts: [],
        dependencies: ["asset-2"],
      };

      const assets = [asset1, asset2, asset3];

      // Scene asset mapping
      this._state = AssetState.SCENE_MAPPING;
      const groups: AssetGroup[] = [
        { id: "group-scene-1", name: "Scene 1 Intro visuals", assetIds: ["asset-1"] },
        { id: "group-scene-2", name: "Scene 2 Coding visual assets", assetIds: ["asset-1", "asset-2"] },
        { id: "group-scene-3", name: "Scene 3 CTA overlays", assetIds: ["asset-2", "asset-3"] },
      ];

      // Prompt Planning Engine
      this._state = AssetState.PROMPT_PLANNING;
      for (const asset of assets) {
        asset.prompts = await this._promptEngine.generatePrompts(asset);
      }

      // Visual Style Engine
      this._state = AssetState.STYLE_BUILDING;
      const styleGuide = await this._styleEngine.generateStyleGuide(request.scriptId);

      // Character Planning Engine
      this._state = AssetState.CHARACTER_PLANNING;
      const characters = await this._characterEngine.generateCharacterProfiles(request.scriptId);

      // Media Timeline Planner
      this._state = AssetState.TIMELINE_PLANNING;
      const timeline = await this._timelinePlanner.generateTimeline(assets);

      // Production Dependency Graph
      this._state = AssetState.GRAPH_BUILDING;
      const graph: DependencyGraph = {
        nodeDependencies: {
          "asset-1": [],
          "asset-2": ["asset-1"],
          "asset-3": ["asset-2"],
        },
        generationOrder: ["asset-1", "asset-2", "asset-3"],
        parallelSlots: [["asset-1"], ["asset-2"], ["asset-3"]],
      };

      // Production Optimization Engine
      this._state = AssetState.OPTIMIZATION;
      if (this.context.memoryStore) {
        const winningStyles = await this.context.memoryStore.get("asset-memory", "winning-visual-styles");
        if (winningStyles && winningStyles.value) {
          const list = winningStyles.value as string[];
          if (list.includes(styleGuide.visualStyle)) {
            styleGuide.renderQuality = "Optimized preset based on historically winning visuals.";
          }
        }
      }

      // If ChannelEngine is available, override brand colors on StyleGuide
      if (this.context.channelEngine) {
        const history = this.context.channelEngine.getHistory();
        if (history.length > 0) {
          const kb = history[history.length - 1];
          styleGuide.colorPalette = [...kb.visuals.colorPalette];
        }
      }

      const report: ProductionReport = {
        id: "rep-prod-" + request.id + "-" + Math.random().toString(36).substring(2, 7),
        timestamp: new Date(),
        assetCount: assets.length,
        promptCount: assets.reduce((acc, a) => acc + a.prompts.length, 0),
        totalCostEstimate: 0.15, // Mock pricing
        renderTimeEstimateSeconds: 120, // 2 minutes mock render
        optimizationsApplied: ["Duplicated background prompt reuse verified", "Shared character voice presets loaded"],
      };

      const response: AssetResponse = {
        productionId: request.id,
        state: AssetState.COMPLETED,
        assets,
        groups,
        styleGuide,
        characters,
        timeline,
        graph,
        reports: [report],
        timestamp: new Date(),
      };

      // Validator check
      AssetValidator.validateResponse(response);

      // Store snapshot & deepFreeze it
      const snapshot: ProductionSnapshot = {
        productionId: request.id,
        state: AssetState.COMPLETED,
        assets: response.assets,
        styleGuide: response.styleGuide,
        timestamp: response.timestamp,
      };
      deepFreeze(snapshot);
      this._snapshots.set(request.id, snapshot);

      // Store in History & Memory
      this._history.push(response);

      if (this.context.memoryStore) {
        await this.context.memoryStore.set(
          "asset-memory",
          `assets:${queryKey}`,
          response,
          { productionId: request.id, totalAssets: assets.length }
        );
      }

      // Publish event AssetPlanningCompleted
      if (this.context.eventBus) {
        await this.context.eventBus.publish({
          id: "evt-asset-complete-" + Math.random().toString(36).substring(2, 11),
          name: "AssetPlanningCompleted",
          timestamp: new Date(),
          correlationId: request.options?.correlationId || "corr-assets-" + request.id,
          source: "AssetEngine",
          payload: { productionId: request.id },
          metadata: {},
        });
      }

      this._state = AssetState.RUNNING; // restore state
      return response;
    } catch (error: any) {
      this._state = AssetState.FAILED;
      
      // Publish event AssetPlanningFailed
      if (this.context.eventBus) {
        await this.context.eventBus.publish({
          id: "evt-asset-fail-" + Math.random().toString(36).substring(2, 11),
          name: "AssetPlanningFailed",
          timestamp: new Date(),
          correlationId: request.options?.correlationId || "corr-assets-" + request.id,
          source: "AssetEngine",
          payload: { productionId: request.id, error: error.message },
          metadata: {},
        });
      }
      throw error;
    }
  }
}
