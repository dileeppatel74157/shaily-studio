import { MemoryOptimizationState } from "./MemoryOptimizationState";
import { CompressionStrategy } from "./CompressionStrategy";
import { DeduplicationStrategy } from "./DeduplicationStrategy";
import { ArchiveState } from "./ArchiveState";
import { RestoreState } from "./RestoreState";
import { MemoryScore } from "./MemoryScore";
import { ContextRank } from "./ContextRank";
import { CleanupPolicy } from "./CleanupPolicy";

// ─── Memory Entry ─────────────────────────────────────────────────────────────

export interface MemoryEntry {
  id: string;
  namespace: string;
  key: string;
  content: string;
  contentHash: string;
  sizeBytes: number;
  compressed: boolean;
  compressionStrategy?: CompressionStrategy;
  compressedSizeBytes?: number;
  score: MemoryScore;
  qualityScore: number;       // 0.0–1.0
  accessCount: number;
  lastAccessedAt: Date;
  projectId?: string;
  workspaceId?: string;
  ttlMs?: number;             // Optional time-to-live in ms
  expiresAt?: Date;
  tags: string[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Compression ──────────────────────────────────────────────────────────────

export interface CompressionRequest {
  entryId: string;
  strategy: CompressionStrategy;
}

export interface CompressionResult {
  entryId: string;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  ratio: number;              // compressedSizeBytes / originalSizeBytes
  strategy: CompressionStrategy;
  success: boolean;
  error?: string;
  durationMs: number;
}

// ─── Deduplication ────────────────────────────────────────────────────────────

export interface DuplicateGroup {
  canonical: MemoryEntry;           // entry to keep
  duplicates: MemoryEntry[];        // entries to remove or merge
  strategy: DeduplicationStrategy;
  similarityScore: number;
}

export interface DeduplicationResult {
  duplicateGroupsFound: number;
  entriesRemoved: number;
  bytesSaved: number;
  durationMs: number;
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

export interface CleanupRequest {
  policies: CleanupPolicy[];
  olderThanMs?: number;
  minScore?: MemoryScore;
  dryRun?: boolean;
}

export interface CleanupResult {
  entriesRemoved: number;
  bytesSaved: number;
  snapshotsRemoved: number;
  orphansRemoved: number;
  durationMs: number;
  dryRun: boolean;
}

// ─── Archive ──────────────────────────────────────────────────────────────────

export interface ArchiveRecord {
  id: string;
  label: string;
  state: ArchiveState;
  entryIds: string[];
  projectId?: string;
  workspaceId?: string;
  sizeBytes: number;
  compressedSizeBytes: number;
  version: number;
  createdAt: Date;
  restoredAt?: Date;
  metadata: Record<string, any>;
}

export interface ArchiveRequest {
  label: string;
  entryIds: string[];
  projectId?: string;
  workspaceId?: string;
  metadata?: Record<string, any>;
}

export interface ArchiveResult {
  archiveId: string;
  entriesArchived: number;
  sizeBytes: number;
  durationMs: number;
  success: boolean;
  error?: string;
}

// ─── Restore ─────────────────────────────────────────────────────────────────

export interface RestoreRequest {
  archiveId: string;
  targetNamespace?: string;
}

export interface RestoreResult {
  archiveId: string;
  state: RestoreState;
  entriesRestored: number;
  durationMs: number;
  success: boolean;
  error?: string;
}

// ─── Memory Scoring ───────────────────────────────────────────────────────────

export interface MemoryScoreCard {
  entryId: string;
  score: MemoryScore;
  qualityScore: number;
  accessFrequency: number;
  recencyScore: number;
  importanceScore: number;
  learningValue: number;
  successRate: number;
  founderPreference: number;
  compositeScore: number;
  computedAt: Date;
}

// ─── Context Ranking ─────────────────────────────────────────────────────────

export interface RankedEntry {
  entry: MemoryEntry;
  rank: ContextRank;
  rankScore: number;
  semanticSimilarity: number;
  confidence: number;
  relevanceScore: number;
  freshness: number;
  projectRelevance: number;
  workspaceRelevance: number;
  decisionWeight: number;
}

export interface RankingRequest {
  query: string;
  entries: MemoryEntry[];
  topK?: number;
  projectId?: string;
  workspaceId?: string;
}

export interface RankingResponse {
  query: string;
  ranked: RankedEntry[];
  totalConsidered: number;
  durationMs: number;
}

// ─── Retrieval Optimization ───────────────────────────────────────────────────

export interface IndexOptimizationResult {
  vectorIndexOptimized: boolean;
  metadataIndexOptimized: boolean;
  cacheWarmed: boolean;
  retrievalLatencyReducedMs: number;
  durationMs: number;
}

// ─── Maintenance ─────────────────────────────────────────────────────────────

export interface MaintenanceReport {
  triggeredAt: Date;
  compressionResults: CompressionResult[];
  deduplicationResult: DeduplicationResult;
  cleanupResult: CleanupResult;
  indexOptimization: IndexOptimizationResult;
  entriesScored: number;
  totalDurationMs: number;
}

// ─── Engine Config & Stats ────────────────────────────────────────────────────

export interface MemoryOptimizationConfiguration {
  compressionEnabled: boolean;
  defaultCompressionStrategy: CompressionStrategy;
  deduplicationEnabled: boolean;
  defaultDeduplicationStrategy: DeduplicationStrategy;
  autoCleanupEnabled: boolean;
  cleanupIntervalMs: number;
  defaultCleanupPolicies: CleanupPolicy[];
  archivingEnabled: boolean;
  scoringEnabled: boolean;
  rankingTopK: number;
  persistenceEnabled: boolean;
  metadata?: Record<string, any>;
}

export interface MemoryOptimizationStatistics {
  totalEntries: number;
  compressedEntries: number;
  totalSizeBytes: number;
  totalCompressedSizeBytes: number;
  duplicatesRemoved: number;
  archivesCreated: number;
  maintenanceRuns: number;
  uptimeMs: number;
}

export interface MemoryOptimizationHealth {
  healthy: boolean;
  compressionReady: boolean;
  deduplicationReady: boolean;
  archiveReady: boolean;
  lastMaintenanceAt?: Date;
  lastCheckTime: Date;
}

export interface MemoryOptimizationSnapshot {
  timestamp: Date;
  state: MemoryOptimizationState;
  entries: MemoryEntry[];
  archives: ArchiveRecord[];
  statistics: MemoryOptimizationStatistics;
}

export interface MemoryOptimizationReport {
  timestamp: Date;
  state: MemoryOptimizationState;
  statistics: MemoryOptimizationStatistics;
  health: MemoryOptimizationHealth;
}
