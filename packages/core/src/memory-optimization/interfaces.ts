import { MemoryOptimizationState } from "./MemoryOptimizationState";
import { CompressionStrategy } from "./CompressionStrategy";
export type IngestEntryInput = {
  namespace: string;
  key: string;
  content: string;
  score?: import("./MemoryScore").MemoryScore;
  qualityScore?: number;
  projectId?: string;
  workspaceId?: string;
  ttlMs?: number;
  tags?: string[];
  metadata?: Record<string, any>;
};
import { DeduplicationStrategy } from "./DeduplicationStrategy";
import { ArchiveState } from "./ArchiveState";
import { RestoreState } from "./RestoreState";
import { MemoryScore } from "./MemoryScore";
import { ContextRank } from "./ContextRank";
import { CleanupPolicy } from "./CleanupPolicy";
import {
  MemoryEntry,
  CompressionRequest, CompressionResult,
  DuplicateGroup, DeduplicationResult,
  CleanupRequest, CleanupResult,
  ArchiveRecord, ArchiveRequest, ArchiveResult,
  RestoreRequest, RestoreResult,
  MemoryScoreCard,
  RankedEntry, RankingRequest, RankingResponse,
  IndexOptimizationResult,
  MaintenanceReport,
  MemoryOptimizationConfiguration,
  MemoryOptimizationStatistics,
  MemoryOptimizationSnapshot,
  MemoryOptimizationReport,
} from "./models";

// ─── Main Engine Interface ───────────────────────────────────────────────────

export interface IMemoryOptimizationEngine {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;

  getState(): MemoryOptimizationState;
  getConfig(): MemoryOptimizationConfiguration;

  // Core operations
  ingestEntry(entry: IngestEntryInput): Promise<MemoryEntry>;
  getEntry(entryId: string): MemoryEntry;
  updateEntry(entryId: string, updates: Partial<MemoryEntry>): void;
  removeEntry(entryId: string): void;
  listEntries(namespace?: string): MemoryEntry[];

  // Optimization operations
  runCompression(request?: CompressionRequest): Promise<CompressionResult[]>;
  runDeduplication(strategy?: DeduplicationStrategy): Promise<DeduplicationResult>;
  runCleanup(request?: CleanupRequest): Promise<CleanupResult>;
  runArchive(request: ArchiveRequest): Promise<ArchiveResult>;
  runRestore(request: RestoreRequest): Promise<RestoreResult>;
  runIndexOptimization(): Promise<IndexOptimizationResult>;
  runMaintenance(): Promise<MaintenanceReport>;

  // Scoring & ranking
  scoreEntry(entryId: string): MemoryScoreCard;
  rankContext(request: RankingRequest): RankingResponse;

  // Managers
  getCompressionManager(): ICompressionManager;
  getDeduplicationManager(): IDeduplicationManager;
  getCleanupManager(): ICleanupManager;
  getArchiveManager(): IArchiveManager;
  getRetrievalOptimizer(): IRetrievalOptimizer;
  getScoringManager(): IScoringManager;
  getRankingManager(): IRankingManager;
  getMaintenanceScheduler(): IMaintenanceScheduler;
  getReporter(): IMemoryOptimizationReporter;

  on(event: string, handler: (payload: any) => void): void;
  off(event: string, handler: (payload: any) => void): void;
  emit(event: string, payload?: any): void;
}

// ─── Sub-manager Interfaces ──────────────────────────────────────────────────

export interface ICompressionManager {
  compress(entry: MemoryEntry, strategy: CompressionStrategy): CompressionResult;
  decompress(entry: MemoryEntry): string;
  summarize(content: string, maxLength?: number): string;
  compressAll(entries: MemoryEntry[], strategy: CompressionStrategy): CompressionResult[];
}

export interface IDeduplicationManager {
  detectDuplicates(entries: MemoryEntry[], strategy: DeduplicationStrategy): DuplicateGroup[];
  mergeGroup(group: DuplicateGroup): MemoryEntry;
  removeDuplicates(entries: MemoryEntry[], strategy: DeduplicationStrategy): DeduplicationResult;
}

export interface ICleanupManager {
  runCleanup(entries: MemoryEntry[], request: CleanupRequest): CleanupResult;
  isExpired(entry: MemoryEntry): boolean;
  isOrphan(entry: MemoryEntry, allEntries: MemoryEntry[]): boolean;
}

export interface IArchiveManager {
  createArchive(request: ArchiveRequest, entries: MemoryEntry[]): ArchiveResult;
  restoreArchive(request: RestoreRequest): RestoreResult;
  getArchive(archiveId: string): ArchiveRecord | undefined;
  listArchives(): ArchiveRecord[];
  deleteArchive(archiveId: string): void;
}

export interface IRetrievalOptimizer {
  optimizeIndexes(): IndexOptimizationResult;
  warmCache(entries: MemoryEntry[]): void;
  getRetrievalLatency(): number;
}

export interface IScoringManager {
  scoreEntry(entry: MemoryEntry): MemoryScoreCard;
  rescoreAll(entries: MemoryEntry[]): MemoryScoreCard[];
  updateAccessStats(entryId: string, entries: MemoryEntry[]): void;
}

export interface IRankingManager {
  rank(request: RankingRequest): RankingResponse;
  computeSemanticSimilarity(query: string, content: string): number;
  computeFreshness(entry: MemoryEntry): number;
}

export interface IMaintenanceScheduler {
  scheduleNext(delayMs: number): void;
  cancelScheduled(): void;
  getLastRunAt(): Date | undefined;
  getNextRunAt(): Date | undefined;
  isScheduled(): boolean;
}

export interface IMemoryOptimizationReporter {
  generateReport(): MemoryOptimizationReport;
  getSnapshot(): MemoryOptimizationSnapshot;
}
