export { MemoryOptimizationState } from "./types/MemoryOptimizationState";
export { CompressionStrategy } from "./types/CompressionStrategy";
export { DeduplicationStrategy } from "./types/DeduplicationStrategy";
export { ArchiveState } from "./types/ArchiveState";
export { RestoreState } from "./types/RestoreState";
export { MemoryScore } from "./models/MemoryScore";
export { ContextRank } from "./types/ContextRank";
export { CleanupPolicy } from "./types/CleanupPolicy";

export * from "./models/models";
export * from "./interfaces/interfaces"; // includes IngestEntryInput
export * from "./types/types";

export { MemoryOptimizationValidator } from "./validation/MemoryOptimizationValidator";
export { MemoryOptimizationEngine } from "./engine/MemoryOptimizationEngine";
export { MemoryOptimizationBuilder } from "./builder/MemoryOptimizationBuilder";
