import { IMemoryOptimizationEngine } from "./interfaces";
import { MemoryOptimizationEngine } from "./MemoryOptimizationEngine";
import { MemoryOptimizationConfiguration } from "./models";
import { CompressionStrategy } from "./CompressionStrategy";
import { DeduplicationStrategy } from "./DeduplicationStrategy";
import { CleanupPolicy } from "./CleanupPolicy";
import { MemoryOptimizationValidationException } from "./types";

export class MemoryOptimizationBuilder {
  private _context?: any;
  private _config?: MemoryOptimizationConfiguration;

  public withContext(context: any): this {
    this._context = context;
    return this;
  }

  public withConfig(config: MemoryOptimizationConfiguration): this {
    this._config = config;
    return this;
  }

  public build(): IMemoryOptimizationEngine {
    if (!this._context) {
      throw new MemoryOptimizationValidationException("Context is required to build MemoryOptimizationEngine.");
    }
    const config: MemoryOptimizationConfiguration = this._config ?? {
      compressionEnabled: true,
      defaultCompressionStrategy: CompressionStrategy.LOSSLESS,
      deduplicationEnabled: true,
      defaultDeduplicationStrategy: DeduplicationStrategy.HASH_FINGERPRINT,
      autoCleanupEnabled: false,
      cleanupIntervalMs: 60_000,
      defaultCleanupPolicies: [CleanupPolicy.EXPIRED_TTL],
      archivingEnabled: true,
      scoringEnabled: true,
      rankingTopK: 10,
      persistenceEnabled: false,
    };
    return new MemoryOptimizationEngine(this._context, config);
  }
}
