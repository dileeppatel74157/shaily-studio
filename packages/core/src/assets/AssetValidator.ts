import { AssetValidationException } from "./types";
import { AssetRequest, AssetResponse, ProductionAsset, StyleGuide } from "./models";

export class AssetValidator {
  public static validateRequest(request: AssetRequest): void {
    if (!request.id) {
      throw new AssetValidationException("Request ID is required.");
    }
    if (!request.scriptId) {
      throw new AssetValidationException("Script ID is required.");
    }
  }

  public static validateResponse(response: AssetResponse): void {
    if (!response.productionId) {
      throw new AssetValidationException("Response productionId is required.");
    }

    const assets = response.assets;
    const styleGuide = response.styleGuide;
    const timeline = response.timeline;

    // 1. Duplicate assets check
    const assetIds = new Set<string>();
    for (const asset of assets) {
      if (assetIds.has(asset.id)) {
        throw new AssetValidationException(`Duplicate asset ID detected: ${asset.id}`);
      }
      assetIds.add(asset.id);
    }

    // 2. Missing style information check
    this.validateStyleGuide(styleGuide);

    // 3. Invalid prompts check
    for (const asset of assets) {
      if (!asset.prompts || asset.prompts.length === 0) {
        throw new AssetValidationException(`Asset "${asset.id}" has no prompts.`);
      }
      for (const p of asset.prompts) {
        if (!p.promptText || p.promptText.trim().length === 0) {
          throw new AssetValidationException(`Asset "${asset.id}" prompt text cannot be empty.`);
        }
      }
    }

    // 4. Invalid dependencies check
    for (const asset of assets) {
      for (const depId of asset.dependencies) {
        if (!assetIds.has(depId)) {
          throw new AssetValidationException(`Invalid dependency: Asset "${asset.id}" depends on non-existent asset "${depId}".`);
        }
      }
    }

    // 5. Missing assets check: verify group asset IDs actually exist
    for (const group of response.groups) {
      for (const aid of group.assetIds) {
        if (!assetIds.has(aid)) {
          throw new AssetValidationException(`Missing asset: Group "${group.id}" references non-existent asset "${aid}".`);
        }
      }
    }

    // 6. Timing conflicts check
    for (const key of Object.keys(timeline.assetTimings)) {
      const timing = timeline.assetTimings[key];
      if (timing.start < 0 || timing.duration <= 0) {
        throw new AssetValidationException(`Timing Conflict: Asset "${key}" has invalid timing (start: ${timing.start}s, duration: ${timing.duration}s).`);
      }
    }

    for (const key of Object.keys(timeline.overlayTimings)) {
      const timing = timeline.overlayTimings[key];
      if (timing.start < 0 || timing.duration <= 0) {
        throw new AssetValidationException(`Timing Conflict: Overlay "${key}" has invalid timing (start: ${timing.start}s, duration: ${timing.duration}s).`);
      }
    }

    // 7. Circular dependency graph check
    this.validateDependencies(assets);
  }

  private static validateStyleGuide(style: StyleGuide): void {
    if (!style.visualStyle) {
      throw new AssetValidationException("Visual style type is required in style guide.");
    }
    if (!style.colorPalette || style.colorPalette.length === 0) {
      throw new AssetValidationException("Color palette is required in style guide.");
    }
    if (!style.aspectRatio) {
      throw new AssetValidationException("Aspect ratio is required in style guide.");
    }
    if (!style.resolution) {
      throw new AssetValidationException("Resolution is required in style guide.");
    }
  }

  public static validateDependencies(assets: ProductionAsset[]): void {
    const assetMap = new Map<string, ProductionAsset>();
    for (const asset of assets) {
      assetMap.set(asset.id, asset);
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const checkCycle = (id: string) => {
      if (recStack.has(id)) {
        throw new AssetValidationException(`Circular dependency detected in assets: loop contains "${id}"`);
      }
      if (!visited.has(id)) {
        visited.add(id);
        recStack.add(id);
        const asset = assetMap.get(id);
        if (asset) {
          for (const depId of asset.dependencies) {
            checkCycle(depId);
          }
        }
        recStack.delete(id);
      }
    };

    for (const asset of assets) {
      checkCycle(asset.id);
    }
  }
}
