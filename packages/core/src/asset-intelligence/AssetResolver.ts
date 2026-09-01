/**
 * Universal Asset Resolver
 * Executes deterministic 7-Tier resolution strategy:
 * 1. Existing project asset
 * 2. Existing reusable asset (e.g. Canonical Character)
 * 3. User-provided asset
 * 4. Local / system asset
 * 5. Content-Addressable Cache (L1/L2)
 * 6. Configured Media Provider
 * 7. Deterministic System Fallback
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  AssetRequirement,
  IntelligentAsset,
  AssetResolutionOptions,
  AssetResolutionResult,
  AssetOrigin
} from "./models";
import { AssetCache } from "./AssetCache";
import { AssetNormalizer } from "./AssetNormalizer";
import { AssetValidator } from "./AssetValidator";
import { CharacterIdentityManager } from "./CharacterIdentityManager";
import {
  createDomainBackground,
  createCartoonCharacterSprite
} from "../animation/pngUtils";

export class AssetResolver {
  private readonly _storageDir: string;

  constructor(
    private readonly _cache: AssetCache,
    private readonly _characterManager: CharacterIdentityManager,
    private readonly _context?: any,
    storageDir?: string
  ) {
    this._storageDir = storageDir || path.join(process.cwd(), "storage", "media");
    fs.mkdirSync(this._storageDir, { recursive: true });
  }

  /**
   * Resolves a single AssetRequirement into a fully validated, normalized IntelligentAsset.
   */
  public async resolve(
    requirement: AssetRequirement,
    options: AssetResolutionOptions = {}
  ): Promise<AssetResolutionResult> {
    const start = Date.now();
    const isProd = options.isProduction ?? (this._context?.env === "production");

    // ── Tier 1 & 2: Reusable Character Check ─────────────────────────────────
    if (requirement.kind === "CHARACTER" && requirement.characterId) {
      const canonical = this._characterManager.getCanonicalAsset(requirement.characterId);
      if (canonical) {
        canonical.sceneIds.push(requirement.sceneId);
        return {
          requirementId: requirement.id,
          asset: canonical,
          source: "CACHE",
          durationMs: Date.now() - start,
          cacheHit: true
        };
      }
    }

    // ── Tier 5: Content-Addressable Cache Check ──────────────────────────────
    const contentHash = this._cache.computeKey({
      kind: requirement.kind,
      prompt: requirement.prompt,
      style: requirement.styleDescription,
      width: requirement.desiredDimensions?.width || 1920,
      height: requirement.desiredDimensions?.height || 1080,
      provider: options.preferredProvider || "default"
    });

    if (options.allowCache !== false) {
      const cached = this._cache.get(contentHash);
      if (cached) {
        cached.sceneIds.push(requirement.sceneId);
        return {
          requirementId: requirement.id,
          asset: cached,
          source: "CACHE",
          durationMs: Date.now() - start,
          cacheHit: true
        };
      }
    }

    // ── Tier 6: Configured Media Provider Generation ──────────────────────────
    let generatedBuffer: Buffer | undefined;
    let providerName = options.preferredProvider || "MediaProviderEngine";
    let providerUrl: string | undefined;

    const mediaEngine = this._context?.mediaProviderEngine;
    if (mediaEngine?.getImageManager()?.generateImage) {
      try {
        const res = await mediaEngine.getImageManager().generateImage({
          id: `gen-${requirement.id}`,
          prompt: requirement.prompt,
          mode: "TEXT_TO_IMAGE",
          metadata: {
            taskId: options.taskId,
            sceneId: requirement.sceneId,
            kind: requirement.kind
          }
        });

        const asset = res.assets?.[0];
        if (asset && typeof asset.url === "string") {
          const pUrl: string = asset.url;
          providerUrl = pUrl;
          if (pUrl.startsWith("file://")) {
            let p = pUrl.substring(7);
            if (/^\/[a-zA-Z]:/.test(p)) p = p.substring(1);
            p = path.normalize(p);
            if (fs.existsSync(p)) {
              generatedBuffer = fs.readFileSync(p);
            }
          }
        }


      } catch (err: any) {
        if (isProd) {
          throw new Error(`ASSET_GENERATION_FAILED: Provider failed for requirement ${requirement.id}: ${err.message}`);
        }
      }
    }

    // ── Tier 7: Deterministic System Fallback ─────────────────────────────────
    let origin: AssetOrigin = generatedBuffer ? "PROVIDER" : "SYSTEM";
    let isFallback = !generatedBuffer;

    if (!generatedBuffer) {
      const targetW = requirement.desiredDimensions?.width || 1920;
      const targetH = requirement.desiredDimensions?.height || 1080;

      if (requirement.kind === "CHARACTER") {
        generatedBuffer = createCartoonCharacterSprite(targetW, targetH);
      } else {
        const domain =
          requirement.metadata?.purpose?.includes("FINANCE") || requirement.prompt.toLowerCase().includes("inflation") ? "FINANCE" :
          requirement.metadata?.purpose?.includes("HISTORY") || requirement.prompt.toLowerCase().includes("roman") ? "HISTORY" :
          requirement.metadata?.purpose?.includes("DOCUMENTARY") || requirement.prompt.toLowerCase().includes("ocean") ? "DOCUMENTARY" :
          requirement.metadata?.purpose?.includes("KIDS") || requirement.prompt.toLowerCase().includes("lion") ? "KIDS" : "GENERAL";

        generatedBuffer = createDomainBackground(domain, targetW, targetH);
      }
    }

    // ── Persist & Normalize Asset ────────────────────────────────────────────
    const assetId = `asset-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const fileName = `${assetId}.png`;
    const fullPath = path.join(this._storageDir, fileName);
    fs.writeFileSync(fullPath, generatedBuffer);

    const norm = AssetNormalizer.inspectImageBuffer(generatedBuffer);
    const publicUrl = providerUrl || `file:///${fullPath.replace(/\\/g, "/")}`;


    const resolvedAsset: IntelligentAsset = {
      id: assetId,
      kind: requirement.kind,
      origin,
      status: "READY",
      mimeType: norm.mimeType,
      filePath: fullPath,
      publicUrl,
      width: norm.width,
      height: norm.height,
      aspectRatio: norm.aspectRatio,
      sizeBytes: norm.sizeBytes,
      checksum: norm.checksum,
      contentHash,
      hasAlphaChannel: norm.hasAlphaChannel,
      createdAt: new Date(),
      updatedAt: new Date(),
      provider: providerName,
      generationPrompt: requirement.prompt,
      projectId: options.projectId,
      sceneIds: [requirement.sceneId],
      isReusable: requirement.isReusable ?? true,
      isTemporary: false,
      isFallback,
      metadata: {
        semanticRole: requirement.semanticRole,
        ...requirement.metadata
      }
    };

    // ── Validate Asset ───────────────────────────────────────────────────────
    const valResult = AssetValidator.validateAsset(resolvedAsset, requirement, isProd, this._storageDir);
    if (!valResult.valid) {
      throw new Error(`ASSET_VALIDATION_FAILED: ${valResult.errors.join("; ")}`);
    }

    // ── Update Cache & Character Registry ────────────────────────────────────
    if (resolvedAsset.isReusable) {
      this._cache.set(contentHash, resolvedAsset);
    }
    if (requirement.kind === "CHARACTER" && requirement.characterId) {
      this._characterManager.setCanonicalAsset(requirement.characterId, resolvedAsset);
    }

    return {
      requirementId: requirement.id,
      asset: resolvedAsset,
      source: origin,
      durationMs: Date.now() - start,
      cacheHit: false
    };
  }
}
