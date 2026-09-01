/**
 * Asset Pipeline Engine
 * Orchestrates Asset Requirement Planning, Resolution, Caching, Normalization,
 * Character Consistency, and Manifest Generation.
 *
 * Sits between Scene Visual Planning and Universal Primitive / Render Compilation.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { Storyboard, Scene, VisualStylePlan } from "../content-pipeline/models";
import {
  AssetManifest,
  AssetManifestEntry,
  AssetResolutionOptions,
  IntelligentAsset
} from "./models";
import { AssetRequirementPlanner } from "./AssetRequirementPlanner";
import { AssetCache, CacheStatistics } from "./AssetCache";
import { CharacterIdentityManager } from "./CharacterIdentityManager";
import { AssetResolver } from "./AssetResolver";

export class AssetPipelineEngine {
  private readonly _cache: AssetCache;
  private readonly _characterManager: CharacterIdentityManager;
  private readonly _resolver: AssetResolver;
  private readonly _manifests = new Map<string, AssetManifest>(); // taskId -> AssetManifest

  constructor(private readonly _context?: any, storageDir?: string) {
    const sDir = storageDir || path.join(process.cwd(), "storage", "media");
    this._cache = new AssetCache(sDir);
    this._characterManager = new CharacterIdentityManager();
    this._resolver = new AssetResolver(this._cache, this._characterManager, this._context, sDir);
  }

  public getCache(): AssetCache {
    return this._cache;
  }

  public getCharacterManager(): CharacterIdentityManager {
    return this._characterManager;
  }

  public getResolver(): AssetResolver {
    return this._resolver;
  }

  /**
   * Plans, resolves, caches, and binds assets for an entire Storyboard.
   */
  public async planAndResolveAssets(
    storyboard: Storyboard,
    stylePlan?: VisualStylePlan,
    options: AssetResolutionOptions = {}
  ): Promise<{ manifest: AssetManifest; resolvedAssets: IntelligentAsset[] }> {
    const taskId = options.taskId || `task-${Date.now()}`;
    const projectId = storyboard.projectId || options.projectId || "project-default";
    const resolvedAssets: IntelligentAsset[] = [];
    const manifestEntries: AssetManifestEntry[] = [];

    let cacheHitCount = 0;
    let generatedCount = 0;
    let fallbackCount = 0;

    // 1. Extract requirements across the storyboard
    const reqPlan = AssetRequirementPlanner.planStoryboardRequirements(storyboard, stylePlan);

    // 2. Resolve requirements scene by scene
    for (const sceneReqs of reqPlan.scenes) {
      const scene = storyboard.scenes.find(s => s.id === sceneReqs.sceneId);
      if (!scene) continue;

      const sceneLayers: any[] = [];

      for (const req of sceneReqs.requirements) {
        const result = await this._resolver.resolve(req, {
          ...options,
          projectId,
          sceneId: scene.id,
          taskId
        });

        const asset = result.asset;
        resolvedAssets.push(asset);

        if (result.cacheHit) cacheHitCount++;
        else if (asset.isFallback) fallbackCount++;
        else generatedCount++;

        // Add to manifest
        manifestEntries.push({
          assetId: asset.id,
          kind: asset.kind,
          origin: asset.origin,
          status: asset.status,
          filePath: asset.filePath,
          publicUrl: asset.publicUrl,
          checksum: asset.checksum,
          sizeBytes: asset.sizeBytes,
          width: asset.width,
          height: asset.height,
          hasAlphaChannel: asset.hasAlphaChannel,
          reusable: asset.isReusable,
          isFallback: asset.isFallback,
          sceneIds: asset.sceneIds
        });

        // 3. Bind asset to Scene Layers
        const layerAssetUrl = asset.filePath ? `file:///${asset.filePath.replace(/\\/g, "/")}` : asset.publicUrl;

        if (req.kind === "BACKGROUND" || req.semanticRole === "background") {
          sceneLayers.push({
            id: `layer-bg-${scene.id}`,
            layerType: "BACKGROUND",
            assetUrl: layerAssetUrl,
            zIndex: 0,
            parallaxRate: 0.3
          });
        } else if (req.kind === "CHARACTER") {
          const actionPreset = scene.animation || scene.animationInstructions?.[0]?.action || "WALK";
          const movement = scene.animationInstructions?.[0]?.movement || {
            startX: actionPreset === "ENTER_LEFT" ? 0.35 : 0.2,
            startY: 0.65,
            endX: actionPreset === "ENTER_LEFT" ? 0.35 : 0.8,
            endY: 0.65
          };

          sceneLayers.push({
            id: `layer-char-${scene.id}`,
            layerType: "CHARACTER",
            characterId: req.characterId || "char-main",
            assetUrl: layerAssetUrl,
            actionPreset,
            movement,
            initialPosition: {
              x: movement.startX,
              y: movement.startY,
              width: 0.35,
              height: 0.52
            },
            zIndex: 1,
            parallaxRate: 1.0
          });
        } else {
          sceneLayers.push({
            id: `layer-${req.kind.toLowerCase()}-${scene.id}`,
            layerType: req.kind,
            assetUrl: layerAssetUrl,
            zIndex: 2,
            parallaxRate: 0.5
          });
        }

      }

      scene.layers = sceneLayers;
    }

    const manifest: AssetManifest = {
      taskId,
      projectId,
      timestamp: new Date(),
      totalAssets: manifestEntries.length,
      cacheHitCount,
      generatedCount,
      fallbackCount,
      assets: manifestEntries
    };

    this._manifests.set(taskId, manifest);
    return { manifest, resolvedAssets };
  }

  /**
   * Retrieves an AssetManifest for a task.
   */
  public getManifest(taskId: string): AssetManifest | undefined {
    return this._manifests.get(taskId);
  }

  /**
   * Returns cache & engine performance statistics.
   */
  public getStatistics(): CacheStatistics {
    return this._cache.getStatistics();
  }
}
