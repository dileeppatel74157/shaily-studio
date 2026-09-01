/**
 * Content-Addressable Asset Cache
 * 2-Tier Caching (In-Memory + Persistent Disk Index).
 * Avoids duplicate asset generations across scenes and projects.
 * Survives process restarts.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { IntelligentAsset } from "./models";
import { AssetNormalizer } from "./AssetNormalizer";

export interface CacheStatistics {
  hits: number;
  misses: number;
  storedCount: number;
  savedGenerations: number;
  hitRatio: number;
}

export class AssetCache {
  private readonly _memoryCache = new Map<string, IntelligentAsset>(); // contentHash -> asset
  private readonly _storageDir: string;
  private readonly _manifestPath: string;

  private _hits = 0;
  private _misses = 0;
  private _savedGenerations = 0;

  constructor(storageDir?: string) {
    this._storageDir = storageDir || path.join(process.cwd(), "storage", "media");
    this._manifestPath = path.join(this._storageDir, "asset-cache-manifest.json");
    this.loadManifest();
  }

  /**
   * Generates deterministic contentHash for caching.
   */
  public computeKey(params: {
    kind: string;
    prompt: string;
    style?: string;
    width?: number;
    height?: number;
    provider?: string;
    seed?: number;
  }): string {
    return AssetNormalizer.computeContentHash(params);
  }

  /**
   * Retrieves an asset from cache by content hash.
   */
  public get(contentHash: string): IntelligentAsset | undefined {
    const asset = this._memoryCache.get(contentHash);
    if (asset) {
      // Verify physical file still exists on disk
      if (!asset.filePath || fs.existsSync(asset.filePath)) {
        this._hits++;
        this._savedGenerations++;
        return asset;
      } else {
        // Stale entry where file was deleted
        this._memoryCache.delete(contentHash);
      }
    }
    this._misses++;
    return undefined;
  }

  /**
   * Stores an asset in the cache.
   */
  public set(contentHash: string, asset: IntelligentAsset): void {
    if (!contentHash) return;
    this._memoryCache.set(contentHash, asset);
    this.saveManifest();
  }

  /**
   * Checks if an asset exists in cache without incrementing hit/miss counters.
   */
  public has(contentHash: string): boolean {
    return this._memoryCache.has(contentHash);
  }

  /**
   * Clears the cache.
   */
  public clear(): void {
    this._memoryCache.clear();
    this._hits = 0;
    this._misses = 0;
    this._savedGenerations = 0;
    if (fs.existsSync(this._manifestPath)) {
      try {
        fs.unlinkSync(this._manifestPath);
      } catch (_) {}
    }
  }

  /**
   * Returns runtime cache statistics.
   */
  public getStatistics(): CacheStatistics {
    const total = this._hits + this._misses;
    return {
      hits: this._hits,
      misses: this._misses,
      storedCount: this._memoryCache.size,
      savedGenerations: this._savedGenerations,
      hitRatio: total > 0 ? this._hits / total : 0
    };
  }

  /**
   * Loads persistent cache index from disk on startup.
   */
  private loadManifest(): void {
    try {
      if (fs.existsSync(this._manifestPath)) {
        const raw = fs.readFileSync(this._manifestPath, "utf-8");
        const entries: Array<{ hash: string; asset: any }> = JSON.parse(raw);
        for (const entry of entries) {
          if (entry.asset && entry.asset.filePath && fs.existsSync(entry.asset.filePath)) {
            entry.asset.createdAt = new Date(entry.asset.createdAt);
            entry.asset.updatedAt = new Date(entry.asset.updatedAt);
            this._memoryCache.set(entry.hash, entry.asset);
          }
        }
      }
    } catch (_) {
      // Manifest load failure handled gracefully
    }
  }

  /**
   * Saves persistent cache index to disk.
   */
  private saveManifest(): void {
    try {
      fs.mkdirSync(this._storageDir, { recursive: true });
      const entries = Array.from(this._memoryCache.entries()).map(([hash, asset]) => ({
        hash,
        asset
      }));
      fs.writeFileSync(this._manifestPath, JSON.stringify(entries, null, 2), "utf-8");
    } catch (_) {
      // Manifest write error ignored for sandbox/read-only environments
    }
  }
}
