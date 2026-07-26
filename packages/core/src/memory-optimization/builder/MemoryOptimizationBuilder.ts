import { IMemoryOptimizationEngine } from "../interfaces/interfaces";
import { MemoryOptimizationEngine } from "../engine/MemoryOptimizationEngine";
import { MemoryOptimizationConfiguration } from "../models/models";
import { CompressionStrategy } from "../types/CompressionStrategy";
import { DeduplicationStrategy } from "../types/DeduplicationStrategy";
import { CleanupPolicy } from "../types/CleanupPolicy";
import { MemoryOptimizationValidationException } from "../types/types";

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
