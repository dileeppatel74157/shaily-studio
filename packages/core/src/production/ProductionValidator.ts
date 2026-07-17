import { ProductionValidationException } from "./types";
import { ProductionRequest, ProductionResponse, ProductionAsset, ProductionPlan, ProductionTimeline, GenerationQueue } from "./models";

export class ProductionValidator {
  public static validateRequest(request: ProductionRequest): void {
    if (!request.id) {
      throw new ProductionValidationException("Request ID is required.");
    }
    if (!request.scriptId) {
      throw new ProductionValidationException("Script ID is required.");
    }
  }

  public static validateResponse(response: ProductionResponse): void {
    if (!response.productionId) {
      throw new ProductionValidationException("Response productionId is required.");
    }

    const plan = response.plan;
    const timeline = response.timeline;
    const queue = response.queue;

    // 1. Empty production plan check
    if (!plan.assets || plan.assets.length === 0) {
      throw new ProductionValidationException("Production plan has no planned assets.");
    }
    if (!plan.scenes || plan.scenes.length === 0) {
      throw new ProductionValidationException("Production plan has no planned scenes.");
    }

    // 2. Duplicate asset IDs check
    const assetIds = new Set<string>();
    for (const asset of plan.assets) {
      if (assetIds.has(asset.id)) {
        throw new ProductionValidationException(`Duplicate asset ID detected: ${asset.id}`);
      }
      assetIds.add(asset.id);
    }

    // 3. Invalid priorities check
    for (const asset of plan.assets) {
      if (!asset.priority) {
        throw new ProductionValidationException(`Asset "${asset.id}" has an invalid or missing priority.`);
      }
    }

    // 4. Missing required assets & asset reference integrity check
    for (const asset of plan.assets) {
      for (const dep of asset.dependencies) {
        if (!assetIds.has(dep.assetId)) {
          throw new ProductionValidationException(
            `Asset reference integrity violation: Asset "${asset.id}" depends on missing asset "${dep.assetId}".`
          );
        }
      }
    }

    // 5. Invalid timelines check
    for (const key of Object.keys(timeline.assets)) {
      const t = timeline.assets[key];
      if (t.start < 0 || t.end < t.start) {
        throw new ProductionValidationException(
          `Invalid timeline bounds for asset "${key}" (start: ${t.start}s, end: ${t.end}s).`
        );
      }
    }

    for (const key of Object.keys(timeline.scenes)) {
      const t = timeline.scenes[key];
      if (t.start < 0 || t.end < t.start) {
        throw new ProductionValidationException(
          `Invalid timeline bounds for scene "${key}" (start: ${t.start}s, end: ${t.end}s).`
        );
      }
    }

    // 6. Timeline overlaps check
    for (const layer of Object.keys(timeline.layers)) {
      const assetList = timeline.layers[layer];
      const sortedTimings = assetList
        .map((aid) => ({ id: aid, timing: timeline.assets[aid] }))
        .filter((item) => item.timing)
        .sort((a, b) => a.timing.start - b.timing.start);

      for (let i = 0; i < sortedTimings.length - 1; i++) {
        if (sortedTimings[i].timing.end > sortedTimings[i + 1].timing.start) {
          throw new ProductionValidationException(
            `Timeline Overlap: Assets "${sortedTimings[i].id}" and "${sortedTimings[i + 1].id}" overlap on layer "${layer}".`
          );
        }
      }
    }

    // 7. Queue ordering check
    const queueOrder = new Map<string, number>();
    queue.items.forEach((id, idx) => queueOrder.set(id, idx));

    for (const asset of plan.assets) {
      const assetIdx = queueOrder.get(asset.id);
      if (assetIdx === undefined) {
        throw new ProductionValidationException(`Queue Ordering Error: Asset "${asset.id}" is missing from generation queue.`);
      }
      for (const dep of asset.dependencies) {
        const depIdx = queueOrder.get(dep.assetId);
        if (depIdx === undefined) {
          throw new ProductionValidationException(
            `Queue Ordering Error: Dependency "${dep.assetId}" is missing from generation queue.`
          );
        }
        if (depIdx >= assetIdx) {
          throw new ProductionValidationException(
            `Queue Ordering Error: Dependency "${dep.assetId}" is sequenced after dependent asset "${asset.id}" in generation queue.`
          );
        }
      }
    }

    // 8. Circular dependencies check
    this.validateDependencies(plan.assets);
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
        throw new ProductionValidationException(`Circular dependency detected in assets: loop contains "${id}"`);
      }
      if (!visited.has(id)) {
        visited.add(id);
        recStack.add(id);
        const asset = assetMap.get(id);
        if (asset) {
          for (const dep of asset.dependencies) {
            checkCycle(dep.assetId);
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
