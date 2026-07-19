import { MemoryOptimizationState } from "./MemoryOptimizationState";
import { CompressionStrategy } from "./CompressionStrategy";
import { DeduplicationStrategy } from "./DeduplicationStrategy";
import { ArchiveState } from "./ArchiveState";
import { MemoryScore } from "./MemoryScore";
import { CleanupPolicy } from "./CleanupPolicy";
import {
  MemoryEntry,
  CompressionRequest,
  CleanupRequest,
  ArchiveRequest,
  MemoryOptimizationConfiguration,
  MemoryOptimizationSnapshot,
} from "./models";
import {
  MemoryOptimizationValidationException,
  InvalidMemoryOptimizationStateException,
} from "./types";

export class MemoryOptimizationValidator {

  /**
   * 1. Validate identifier format.
   */
  public static validateId(id: string, label = "ID"): void {
    if (!id || typeof id !== "string") {
      throw new MemoryOptimizationValidationException(`${label} must be a non-empty string.`);
    }
    if (!/^[a-zA-Z0-9_\-]+$/.test(id)) {
      throw new MemoryOptimizationValidationException(`${label} "${id}" contains illegal characters.`);
    }
  }

  /**
   * 2. Validate MemoryEntry.
   */
  public static validateMemoryEntry(entry: MemoryEntry): void {
    if (!entry) throw new MemoryOptimizationValidationException("Memory entry is missing.");
    this.validateId(entry.id, "Entry ID");
    if (!entry.namespace || typeof entry.namespace !== "string") {
      throw new MemoryOptimizationValidationException("namespace must be a non-empty string.");
    }
    if (!entry.key || typeof entry.key !== "string") {
      throw new MemoryOptimizationValidationException("key must be a non-empty string.");
    }
    if (typeof entry.content !== "string") {
      throw new MemoryOptimizationValidationException("content must be a string.");
    }
    if (!Object.values(MemoryScore).includes(entry.score)) {
      throw new MemoryOptimizationValidationException(`Invalid memory score "${entry.score}".`);
    }
    if (typeof entry.qualityScore !== "number" || entry.qualityScore < 0 || entry.qualityScore > 1) {
      throw new MemoryOptimizationValidationException("qualityScore must be between 0 and 1.");
    }
    if (!Array.isArray(entry.tags)) {
      throw new MemoryOptimizationValidationException("tags must be an array.");
    }
    if (!entry.metadata || typeof entry.metadata !== "object") {
      throw new MemoryOptimizationValidationException("metadata must be an object.");
    }
  }

  /**
   * 3. Validate compression result integrity.
   */
  public static validateCompressionIntegrity(original: string, decompressed: string): void {
    if (original !== decompressed) {
      throw new MemoryOptimizationValidationException(
        "Compression integrity check failed: decompressed content does not match original."
      );
    }
  }

  /**
   * 4. Validate archive consistency.
   */
  public static validateArchiveConsistency(archiveEntryIds: string[], availableEntryIds: Set<string>): void {
    for (const id of archiveEntryIds) {
      if (!availableEntryIds.has(id)) {
        throw new MemoryOptimizationValidationException(`Archive references missing entry "${id}".`);
      }
    }
  }

  /**
   * 5. Validate score range.
   */
  public static validateScoreRange(value: number, label: string): void {
    if (typeof value !== "number" || value < 0 || value > 1) {
      throw new MemoryOptimizationValidationException(`${label} must be between 0 and 1. Got: ${value}.`);
    }
  }

  /**
   * 6. Validate cleanup request.
   */
  public static validateCleanupRequest(request: CleanupRequest): void {
    if (!request) throw new MemoryOptimizationValidationException("CleanupRequest is missing.");
    if (!Array.isArray(request.policies) || request.policies.length === 0) {
      throw new MemoryOptimizationValidationException("CleanupRequest must include at least one policy.");
    }
    for (const p of request.policies) {
      if (!Object.values(CleanupPolicy).includes(p)) {
        throw new MemoryOptimizationValidationException(`Invalid cleanup policy "${p}".`);
      }
    }
    if (request.olderThanMs !== undefined && (typeof request.olderThanMs !== "number" || request.olderThanMs <= 0)) {
      throw new MemoryOptimizationValidationException("olderThanMs must be a positive number.");
    }
  }

  /**
   * 7. Validate archive request.
   */
  public static validateArchiveRequest(request: ArchiveRequest): void {
    if (!request) throw new MemoryOptimizationValidationException("ArchiveRequest is missing.");
    if (!request.label || typeof request.label !== "string") {
      throw new MemoryOptimizationValidationException("Archive label must be a non-empty string.");
    }
    if (!Array.isArray(request.entryIds) || request.entryIds.length === 0) {
      throw new MemoryOptimizationValidationException("ArchiveRequest must include at least one entry ID.");
    }
    for (const id of request.entryIds) {
      this.validateId(id, "Archive entry ID");
    }
  }

  /**
   * 8. Validate compression strategy.
   */
  public static validateCompressionStrategy(strategy: CompressionStrategy): void {
    if (!Object.values(CompressionStrategy).includes(strategy)) {
      throw new MemoryOptimizationValidationException(`Invalid compression strategy "${strategy}".`);
    }
  }

  /**
   * 9. Validate deduplication strategy.
   */
  public static validateDeduplicationStrategy(strategy: DeduplicationStrategy): void {
    if (!Object.values(DeduplicationStrategy).includes(strategy)) {
      throw new MemoryOptimizationValidationException(`Invalid deduplication strategy "${strategy}".`);
    }
  }

  /**
   * 10. Validate state transition.
   */
  public static validateStateTransition(current: MemoryOptimizationState, target: MemoryOptimizationState): void {
    const allowed: Record<MemoryOptimizationState, MemoryOptimizationState[]> = {
      [MemoryOptimizationState.CREATED]: [MemoryOptimizationState.INITIALIZING, MemoryOptimizationState.FAILED],
      [MemoryOptimizationState.INITIALIZING]: [MemoryOptimizationState.READY, MemoryOptimizationState.FAILED],
      [MemoryOptimizationState.READY]: [
        MemoryOptimizationState.COMPRESSING, MemoryOptimizationState.DEDUPLICATING,
        MemoryOptimizationState.CLEANING, MemoryOptimizationState.ARCHIVING,
        MemoryOptimizationState.RESTORING, MemoryOptimizationState.OPTIMIZING,
        MemoryOptimizationState.PAUSED, MemoryOptimizationState.STOPPING, MemoryOptimizationState.FAILED,
      ],
      [MemoryOptimizationState.COMPRESSING]: [MemoryOptimizationState.READY, MemoryOptimizationState.FAILED],
      [MemoryOptimizationState.DEDUPLICATING]: [MemoryOptimizationState.READY, MemoryOptimizationState.FAILED],
      [MemoryOptimizationState.CLEANING]: [MemoryOptimizationState.READY, MemoryOptimizationState.FAILED],
      [MemoryOptimizationState.ARCHIVING]: [MemoryOptimizationState.READY, MemoryOptimizationState.FAILED],
      [MemoryOptimizationState.RESTORING]: [MemoryOptimizationState.READY, MemoryOptimizationState.FAILED],
      [MemoryOptimizationState.OPTIMIZING]: [MemoryOptimizationState.READY, MemoryOptimizationState.FAILED],
      [MemoryOptimizationState.PAUSED]: [MemoryOptimizationState.READY, MemoryOptimizationState.STOPPING, MemoryOptimizationState.FAILED],
      [MemoryOptimizationState.STOPPING]: [MemoryOptimizationState.STOPPED, MemoryOptimizationState.FAILED],
      [MemoryOptimizationState.STOPPED]: [MemoryOptimizationState.INITIALIZING, MemoryOptimizationState.FAILED],
      [MemoryOptimizationState.FAILED]: [MemoryOptimizationState.INITIALIZING, MemoryOptimizationState.FAILED],
    };
    if (!allowed[current]?.includes(target)) {
      throw new InvalidMemoryOptimizationStateException(`transition to ${target}`, current);
    }
  }

  /**
   * 11. Validate configuration.
   */
  public static validateConfiguration(config: MemoryOptimizationConfiguration): void {
    if (!config) throw new MemoryOptimizationValidationException("Configuration is missing.");
    if (typeof config.cleanupIntervalMs !== "number" || config.cleanupIntervalMs <= 0) {
      throw new MemoryOptimizationValidationException("cleanupIntervalMs must be a positive number.");
    }
    if (typeof config.rankingTopK !== "number" || config.rankingTopK <= 0) {
      throw new MemoryOptimizationValidationException("rankingTopK must be a positive number.");
    }
    this.validateCompressionStrategy(config.defaultCompressionStrategy);
    this.validateDeduplicationStrategy(config.defaultDeduplicationStrategy);
  }

  /**
   * 12. Validate snapshot immutability.
   */
  public static validateSnapshotImmutability(snap: MemoryOptimizationSnapshot): void {
    if (!snap) throw new MemoryOptimizationValidationException("Snapshot is missing.");
    if (!Object.isFrozen(snap)) {
      throw new MemoryOptimizationValidationException("Snapshot is not frozen.");
    }
    if (!Object.isFrozen(snap.entries) || snap.entries.some(e => !Object.isFrozen(e))) {
      throw new MemoryOptimizationValidationException("Snapshot entries are not fully frozen.");
    }
    if (!Object.isFrozen(snap.archives) || snap.archives.some(a => !Object.isFrozen(a))) {
      throw new MemoryOptimizationValidationException("Snapshot archives are not fully frozen.");
    }
    if (!Object.isFrozen(snap.statistics)) {
      throw new MemoryOptimizationValidationException("Snapshot statistics are not frozen.");
    }
  }

  /**
   * 13. Validate index consistency (entries marked optimized must be in index).
   */
  public static validateIndexConsistency(entries: MemoryEntry[], indexedIds: Set<string>): void {
    for (const e of entries) {
      if (!indexedIds.has(e.id)) {
        throw new MemoryOptimizationValidationException(`Entry "${e.id}" is missing from the index.`);
      }
    }
  }

  /**
   * 14. Validate ranking correctness (scores descending).
   */
  public static validateRankingOrder(scores: number[]): void {
    for (let i = 1; i < scores.length; i++) {
      if (scores[i] > scores[i - 1]) {
        throw new MemoryOptimizationValidationException(
          `Ranking is not in descending order at index ${i}: ${scores[i - 1]} < ${scores[i]}.`
        );
      }
    }
  }

  /**
   * 15. Validate restore integrity: all archived entry IDs are present after restore.
   */
  public static validateRestoreIntegrity(archivedIds: string[], restoredIds: Set<string>): void {
    for (const id of archivedIds) {
      if (!restoredIds.has(id)) {
        throw new MemoryOptimizationValidationException(`Restore integrity failed: entry "${id}" was not restored.`);
      }
    }
  }
}
