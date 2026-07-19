import {
  IMemoryOptimizationEngine, ICompressionManager, IDeduplicationManager,
  ICleanupManager, IArchiveManager, IRetrievalOptimizer, IScoringManager,
  IRankingManager, IMaintenanceScheduler, IMemoryOptimizationReporter,
  IngestEntryInput,
} from "./interfaces";
import { MemoryOptimizationState } from "./MemoryOptimizationState";
import { CompressionStrategy } from "./CompressionStrategy";
import { DeduplicationStrategy } from "./DeduplicationStrategy";
import { ArchiveState } from "./ArchiveState";
import { RestoreState } from "./RestoreState";
import { MemoryScore } from "./MemoryScore";
import { ContextRank } from "./ContextRank";
import { CleanupPolicy } from "./CleanupPolicy";
import {
  MemoryEntry, CompressionRequest, CompressionResult, DuplicateGroup,
  DeduplicationResult, CleanupRequest, CleanupResult, ArchiveRecord,
  ArchiveRequest, ArchiveResult, RestoreRequest, RestoreResult,
  MemoryScoreCard, RankedEntry, RankingRequest, RankingResponse,
  IndexOptimizationResult, MaintenanceReport, MemoryOptimizationConfiguration,
  MemoryOptimizationStatistics, MemoryOptimizationSnapshot, MemoryOptimizationReport,
} from "./models";
import {
  MemoryOptimizationException, MemoryEntryNotFoundException, ArchiveNotFoundException,
  CompressionException, DeduplicationException, RestoreException,
  MemoryOptimizationValidationException, InvalidMemoryOptimizationStateException,
  hashString, deepFreeze,
} from "./types";
import { MemoryOptimizationValidator } from "./MemoryOptimizationValidator";

export class MemoryOptimizationEngine implements IMemoryOptimizationEngine {
  private _state = MemoryOptimizationState.CREATED;
  private readonly _events = new Map<string, Set<(p: any) => void>>();
  private _bootTime = Date.now();
  private _maintenanceRuns = 0;
  private _duplicatesRemoved = 0;

  private readonly _entries = new Map<string, MemoryEntry>();
  private readonly _compressionMgr: CompressionManagerImpl;
  private readonly _dedupMgr: DeduplicationManagerImpl;
  private readonly _cleanupMgr: CleanupManagerImpl;
  private readonly _archiveMgr: ArchiveManagerImpl;
  private readonly _retrievalOptimizer: RetrievalOptimizerImpl;
  private readonly _scoringMgr: ScoringManagerImpl;
  private readonly _rankingMgr: RankingManagerImpl;
  private readonly _maintenanceSched: MaintenanceSchedulerImpl;
  private readonly _reporter: ReporterImpl;

  constructor(
    private readonly _context: any,
    private readonly _config: MemoryOptimizationConfiguration,
  ) {
    MemoryOptimizationValidator.validateConfiguration(_config);
    this._compressionMgr = new CompressionManagerImpl(this);
    this._dedupMgr = new DeduplicationManagerImpl(this);
    this._cleanupMgr = new CleanupManagerImpl(this);
    this._archiveMgr = new ArchiveManagerImpl(this);
    this._retrievalOptimizer = new RetrievalOptimizerImpl(this);
    this._scoringMgr = new ScoringManagerImpl(this);
    this._rankingMgr = new RankingManagerImpl(this);
    this._maintenanceSched = new MaintenanceSchedulerImpl(this);
    this._reporter = new ReporterImpl(this);
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  public async initialize(): Promise<void> {
    if (this._state !== MemoryOptimizationState.CREATED && this._state !== MemoryOptimizationState.STOPPED) {
      throw new InvalidMemoryOptimizationStateException("initialize", this._state);
    }
    this._state = MemoryOptimizationState.INITIALIZING;
    await this._log("memory-optimization", "init_start", { ts: new Date() });
    try {
      if (this._config.persistenceEnabled) {
        const saved = await this._get<MemoryEntry[]>("memory-optimization", "all_entries");
        if (saved) for (const e of saved) this._entries.set(e.id, e);
      }
      this._state = MemoryOptimizationState.READY;
      await this._log("memory-optimization", "init_done", { ts: new Date() });
    } catch (err: any) {
      this._state = MemoryOptimizationState.FAILED;
      throw new MemoryOptimizationException(`Init failed: ${err.message}`);
    }
  }

  public async start(): Promise<void> {
    if (this._state !== MemoryOptimizationState.READY && this._state !== MemoryOptimizationState.STOPPED) {
      throw new InvalidMemoryOptimizationStateException("start", this._state);
    }
    this._state = MemoryOptimizationState.READY;
    this._bootTime = Date.now();
    this.emit("EngineStarted", { ts: new Date() });
    if (this._config.autoCleanupEnabled) {
      this._maintenanceSched.scheduleNext(this._config.cleanupIntervalMs);
    }
  }

  public async stop(): Promise<void> {
    if (this._state === MemoryOptimizationState.STOPPED) return;
    this._maintenanceSched.cancelScheduled();
    this._state = MemoryOptimizationState.STOPPING;
    if (this._config.persistenceEnabled) {
      await this._log("memory-optimization", "all_entries", Array.from(this._entries.values()));
    }
    this._state = MemoryOptimizationState.STOPPED;
    this.emit("EngineStopped", { ts: new Date() });
  }

  // ─── Core Entry Management ─────────────────────────────────────────────────

  public async ingestEntry(raw: IngestEntryInput): Promise<MemoryEntry> {
    const id = `me-${Date.now()}-${Math.floor(Math.random() * 99999)}`;
    const entry: MemoryEntry = {
      id,
      namespace: raw.namespace,
      key: raw.key,
      content: raw.content,
      contentHash: hashString(raw.content),
      sizeBytes: Buffer.byteLength(raw.content, "utf8"),
      compressed: false,
      score: raw.score ?? MemoryScore.MEDIUM,
      qualityScore: raw.qualityScore ?? 0.5,
      accessCount: 0,
      lastAccessedAt: new Date(),
      projectId: raw.projectId,
      workspaceId: raw.workspaceId,
      ttlMs: raw.ttlMs,
      expiresAt: raw.ttlMs ? new Date(Date.now() + raw.ttlMs) : undefined,
      tags: raw.tags ?? [],
      metadata: raw.metadata ?? {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    MemoryOptimizationValidator.validateMemoryEntry(entry);
    this._entries.set(id, entry);
    await this._log("memory-optimization", `entry-${id}`, entry);
    return entry;
  }

  public getEntry(entryId: string): MemoryEntry {
    const e = this._entries.get(entryId);
    if (!e) throw new MemoryEntryNotFoundException(entryId);
    e.accessCount++;
    e.lastAccessedAt = new Date();
    return e;
  }

  public updateEntry(entryId: string, updates: Partial<MemoryEntry>): void {
    const e = this._entries.get(entryId);
    if (!e) throw new MemoryEntryNotFoundException(entryId);
    Object.assign(e, updates, { updatedAt: new Date() });
    if (updates.content) e.contentHash = hashString(updates.content);
  }

  public removeEntry(entryId: string): void {
    if (!this._entries.has(entryId)) throw new MemoryEntryNotFoundException(entryId);
    this._entries.delete(entryId);
  }

  public listEntries(namespace?: string): MemoryEntry[] {
    const all = Array.from(this._entries.values());
    return namespace ? all.filter(e => e.namespace === namespace) : all;
  }

  // ─── Optimization Operations ───────────────────────────────────────────────

  public async runCompression(request?: CompressionRequest): Promise<CompressionResult[]> {
    this._state = MemoryOptimizationState.COMPRESSING;
    this.emit("CompressionStarted", { ts: new Date() });
    let results: CompressionResult[];
    if (request) {
      const entry = this.getEntry(request.entryId);
      results = [this._compressionMgr.compress(entry, request.strategy)];
    } else {
      const strategy = this._config.defaultCompressionStrategy;
      const entries = Array.from(this._entries.values()).filter(e => !e.compressed);
      results = this._compressionMgr.compressAll(entries, strategy);
    }
    this._state = MemoryOptimizationState.READY;
    this.emit("CompressionCompleted", { count: results.length });
    await this._log("compression", `run-${Date.now()}`, results);
    return results;
  }

  public async runDeduplication(strategy?: DeduplicationStrategy): Promise<DeduplicationResult> {
    this._state = MemoryOptimizationState.DEDUPLICATING;
    const strat = strategy ?? this._config.defaultDeduplicationStrategy;
    const entries = Array.from(this._entries.values());
    const result = this._dedupMgr.removeDuplicates(entries, strat);
    this._duplicatesRemoved += result.entriesRemoved;
    this._state = MemoryOptimizationState.READY;
    this.emit("MemoryMerged", { removed: result.entriesRemoved });
    await this._log("deduplication", `run-${Date.now()}`, result);
    return result;
  }

  public async runCleanup(request?: CleanupRequest): Promise<CleanupResult> {
    this._state = MemoryOptimizationState.CLEANING;
    const req: CleanupRequest = request ?? {
      policies: this._config.defaultCleanupPolicies,
      dryRun: false,
    };
    MemoryOptimizationValidator.validateCleanupRequest(req);
    const entries = Array.from(this._entries.values());
    const result = this._cleanupMgr.runCleanup(entries, req);
    this._state = MemoryOptimizationState.READY;
    this.emit("CleanupCompleted", { removed: result.entriesRemoved });
    await this._log("memory-optimization", `cleanup-${Date.now()}`, result);
    return result;
  }

  public async runArchive(request: ArchiveRequest): Promise<ArchiveResult> {
    MemoryOptimizationValidator.validateArchiveRequest(request);
    MemoryOptimizationValidator.validateArchiveConsistency(request.entryIds, new Set(this._entries.keys()));
    this._state = MemoryOptimizationState.ARCHIVING;
    const entries = request.entryIds.map(id => this.getEntry(id));
    const result = this._archiveMgr.createArchive(request, entries);
    if (result.success) {
      for (const id of request.entryIds) this._entries.delete(id);
    }
    this._state = MemoryOptimizationState.READY;
    this.emit("ArchiveCreated", { archiveId: result.archiveId, count: result.entriesArchived });
    await this._log("archives", `archive-${result.archiveId}`, result);
    return result;
  }

  public async runRestore(request: RestoreRequest): Promise<RestoreResult> {
    MemoryOptimizationValidator.validateId(request.archiveId, "Archive ID");
    this._state = MemoryOptimizationState.RESTORING;
    const result = this._archiveMgr.restoreArchive(request);
    if (result.success) {
      const arch = this._archiveMgr.getArchive(request.archiveId);
      if (arch) {
        // Re-ingest restored entry stubs into the live map
        for (const id of arch.entryIds) {
          if (!this._entries.has(id)) {
            const stub: MemoryEntry = {
              id, namespace: request.targetNamespace ?? "restored",
              key: `restored-${id}`, content: "", contentHash: "",
              sizeBytes: 0, compressed: false, score: MemoryScore.MEDIUM,
              qualityScore: 0.5, accessCount: 0, lastAccessedAt: new Date(),
              tags: [], metadata: {}, createdAt: new Date(), updatedAt: new Date(),
            };
            this._entries.set(id, stub);
          }
        }
      }
    }
    this._state = MemoryOptimizationState.READY;
    this.emit("ArchiveRestored", { archiveId: request.archiveId });
    await this._log("restore", `restore-${request.archiveId}`, result);
    return result;
  }

  public async runIndexOptimization(): Promise<IndexOptimizationResult> {
    this._state = MemoryOptimizationState.OPTIMIZING;
    const entries = Array.from(this._entries.values());
    this._retrievalOptimizer.warmCache(entries);
    const result = this._retrievalOptimizer.optimizeIndexes();
    this._state = MemoryOptimizationState.READY;
    this.emit("OptimizationCompleted", { result });
    await this._log("memory-optimization", `index-opt-${Date.now()}`, result);
    return result;
  }

  public async runMaintenance(): Promise<MaintenanceReport> {
    const start = Date.now();
    this._maintenanceRuns++;
    this.emit("MaintenanceStarted", { ts: new Date() });
    await this._log("maintenance", `run-${Date.now()}`, { ts: new Date() });

    const compressionResults = await this.runCompression();
    const deduplicationResult = await this.runDeduplication();
    const cleanupResult = await this.runCleanup();
    const indexOptimization = await this.runIndexOptimization();

    // Score all entries
    const entries = Array.from(this._entries.values());
    const scoreCards = this._scoringMgr.rescoreAll(entries);

    const report: MaintenanceReport = {
      triggeredAt: new Date(),
      compressionResults,
      deduplicationResult,
      cleanupResult,
      indexOptimization,
      entriesScored: scoreCards.length,
      totalDurationMs: Date.now() - start,
    };

    this.emit("MaintenanceCompleted", { report });
    await this._log("maintenance", `report-${Date.now()}`, report);
    return report;
  }

  // ─── Scoring & Ranking ─────────────────────────────────────────────────────

  public scoreEntry(entryId: string): MemoryScoreCard {
    const entry = this.getEntry(entryId);
    const card = this._scoringMgr.scoreEntry(entry);
    this.emit("MemoryScored", { entryId, score: card.compositeScore });
    return card;
  }

  public rankContext(request: RankingRequest): RankingResponse {
    const response = this._rankingMgr.rank(request);
    this.emit("ContextRanked", { query: request.query, count: response.ranked.length });
    return response;
  }

  // ─── Accessors ─────────────────────────────────────────────────────────────

  public getCompressionManager(): ICompressionManager { return this._compressionMgr; }
  public getDeduplicationManager(): IDeduplicationManager { return this._dedupMgr; }
  public getCleanupManager(): ICleanupManager { return this._cleanupMgr; }
  public getArchiveManager(): IArchiveManager { return this._archiveMgr; }
  public getRetrievalOptimizer(): IRetrievalOptimizer { return this._retrievalOptimizer; }
  public getScoringManager(): IScoringManager { return this._scoringMgr; }
  public getRankingManager(): IRankingManager { return this._rankingMgr; }
  public getMaintenanceScheduler(): IMaintenanceScheduler { return this._maintenanceSched; }
  public getReporter(): IMemoryOptimizationReporter { return this._reporter; }
  public getState(): MemoryOptimizationState { return this._state; }
  public getConfig(): MemoryOptimizationConfiguration { return this._config; }
  public getEntryMap(): Map<string, MemoryEntry> { return this._entries; }
  public getUptimeMs(): number { return Date.now() - this._bootTime; }
  public getMaintenanceRuns(): number { return this._maintenanceRuns; }
  public getDuplicatesRemoved(): number { return this._duplicatesRemoved; }

  // ─── Events ────────────────────────────────────────────────────────────────

  public on(event: string, handler: (p: any) => void): void {
    if (!this._events.has(event)) this._events.set(event, new Set());
    this._events.get(event)!.add(handler);
  }
  public off(event: string, handler: (p: any) => void): void {
    this._events.get(event)?.delete(handler);
  }
  public emit(event: string, payload?: any): void {
    for (const h of this._events.get(event) ?? []) {
      try { h(payload); } catch { /* suppress */ }
    }
  }

  // ─── Memory Helpers ────────────────────────────────────────────────────────

  public async _log(ns: string, key: string, value: any): Promise<void> {
    const ms = this._context?.memoryStore;
    if (ms?.set) { try { await ms.set(ns, key, value); } catch { /* suppress */ } }
  }
  public async _get<T>(ns: string, key: string): Promise<T | undefined> {
    const ms = this._context?.memoryStore;
    if (ms?.get) { try { return await ms.get(ns, key) as T; } catch { return undefined; } }
    return undefined;
  }
}

// ─── Compression Manager ──────────────────────────────────────────────────────

class CompressionManagerImpl implements ICompressionManager {
  constructor(private readonly engine: MemoryOptimizationEngine) {}

  public compress(entry: MemoryEntry, strategy: CompressionStrategy): CompressionResult {
    const start = Date.now();
    const original = entry.content;
    let compressed = original;

    switch (strategy) {
      case CompressionStrategy.LOSSLESS:
        // Simulate run-length style: replace 3+ spaces with marker
        compressed = original.replace(/\s{3,}/g, " ");
        break;
      case CompressionStrategy.SEMANTIC:
        // Truncate to first 60% of words (semantic compression simulation)
        const words = original.split(/\s+/);
        compressed = words.slice(0, Math.ceil(words.length * 0.6)).join(" ") + " [...]";
        break;
      case CompressionStrategy.CONTEXT_SUMMARY:
        compressed = this.summarize(original, 100);
        break;
      case CompressionStrategy.METADATA:
        // Store only key metadata fields, drop verbose content
        compressed = JSON.stringify({ summary: original.slice(0, 80), len: original.length });
        break;
      default:
        compressed = original.replace(/\s+/g, " ").trim();
    }

    const compressedSize = Buffer.byteLength(compressed, "utf8");
    entry.compressed = true;
    entry.compressionStrategy = strategy;
    entry.compressedSizeBytes = compressedSize;

    return {
      entryId: entry.id,
      originalSizeBytes: entry.sizeBytes,
      compressedSizeBytes: compressedSize,
      ratio: Math.min(1, compressedSize / Math.max(1, entry.sizeBytes)),
      strategy,
      success: true,
      durationMs: Date.now() - start,
    };
  }

  public decompress(entry: MemoryEntry): string {
    // For simulation purposes, return content as-is
    return entry.content;
  }

  public summarize(content: string, maxLength = 200): string {
    const sentences = content.replace(/\n+/g, " ").split(/[.!?]/).filter(Boolean);
    let summary = "";
    for (const s of sentences) {
      if ((summary + s).length > maxLength) break;
      summary += s.trim() + ". ";
    }
    return summary.trim() || content.slice(0, maxLength);
  }

  public compressAll(entries: MemoryEntry[], strategy: CompressionStrategy): CompressionResult[] {
    return entries.map(e => this.compress(e, strategy));
  }
}

// ─── Deduplication Manager ────────────────────────────────────────────────────

class DeduplicationManagerImpl implements IDeduplicationManager {
  constructor(private readonly engine: MemoryOptimizationEngine) {}

  public detectDuplicates(entries: MemoryEntry[], strategy: DeduplicationStrategy): DuplicateGroup[] {
    const groups: DuplicateGroup[] = [];

    if (strategy === DeduplicationStrategy.EXACT_MATCH || strategy === DeduplicationStrategy.HASH_FINGERPRINT) {
      const hashMap = new Map<string, MemoryEntry[]>();
      for (const e of entries) {
        const key = strategy === DeduplicationStrategy.HASH_FINGERPRINT ? e.contentHash : e.content;
        if (!hashMap.has(key)) hashMap.set(key, []);
        hashMap.get(key)!.push(e);
      }
      for (const [, group] of hashMap) {
        if (group.length > 1) {
          groups.push({ canonical: group[0], duplicates: group.slice(1), strategy, similarityScore: 1.0 });
        }
      }
    } else if (strategy === DeduplicationStrategy.SEMANTIC_SIMILARITY) {
      // Simple word-overlap similarity
      const checked = new Set<string>();
      for (let i = 0; i < entries.length; i++) {
        if (checked.has(entries[i].id)) continue;
        const dupes: MemoryEntry[] = [];
        const wordsA = new Set(entries[i].content.toLowerCase().split(/\s+/));
        for (let j = i + 1; j < entries.length; j++) {
          if (checked.has(entries[j].id)) continue;
          const wordsB = entries[j].content.toLowerCase().split(/\s+/);
          const intersection = wordsB.filter(w => wordsA.has(w)).length;
          const union = new Set([...wordsA, ...wordsB]).size;
          const jaccard = union === 0 ? 0 : intersection / union;
          if (jaccard > 0.8) {
            dupes.push(entries[j]);
            checked.add(entries[j].id);
          }
        }
        if (dupes.length > 0) {
          groups.push({ canonical: entries[i], duplicates: dupes, strategy, similarityScore: 0.85 });
          checked.add(entries[i].id);
        }
      }
    } else if (strategy === DeduplicationStrategy.METADATA_KEY) {
      const keyMap = new Map<string, MemoryEntry[]>();
      for (const e of entries) {
        const k = `${e.namespace}:${e.key}`;
        if (!keyMap.has(k)) keyMap.set(k, []);
        keyMap.get(k)!.push(e);
      }
      for (const [, group] of keyMap) {
        if (group.length > 1) {
          // Keep newest
          const sorted = group.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
          groups.push({ canonical: sorted[0], duplicates: sorted.slice(1), strategy, similarityScore: 1.0 });
        }
      }
    }

    return groups;
  }

  public mergeGroup(group: DuplicateGroup): MemoryEntry {
    // Merge access counts and tags
    for (const dup of group.duplicates) {
      group.canonical.accessCount += dup.accessCount;
      for (const tag of dup.tags) {
        if (!group.canonical.tags.includes(tag)) group.canonical.tags.push(tag);
      }
    }
    return group.canonical;
  }

  public removeDuplicates(entries: MemoryEntry[], strategy: DeduplicationStrategy): DeduplicationResult {
    const start = Date.now();
    const groups = this.detectDuplicates(entries, strategy);
    let removed = 0;
    let bytesSaved = 0;

    for (const group of groups) {
      this.mergeGroup(group);
      for (const dup of group.duplicates) {
        this.engine.emit("DuplicateDetected", { canonical: group.canonical.id, duplicate: dup.id });
        bytesSaved += dup.sizeBytes;
        this.engine.getEntryMap().delete(dup.id);
        removed++;
      }
    }

    return { duplicateGroupsFound: groups.length, entriesRemoved: removed, bytesSaved, durationMs: Date.now() - start };
  }
}

// ─── Cleanup Manager ─────────────────────────────────────────────────────────

class CleanupManagerImpl implements ICleanupManager {
  constructor(private readonly engine: MemoryOptimizationEngine) {}

  public runCleanup(entries: MemoryEntry[], request: CleanupRequest): CleanupResult {
    const start = Date.now();
    let entriesRemoved = 0, bytesSaved = 0, snapshotsRemoved = 0, orphansRemoved = 0;

    const toRemove = new Set<string>();

    for (const entry of entries) {
      const shouldRemove = request.policies.some(policy => {
        if (policy === CleanupPolicy.ALL) return true;
        if (policy === CleanupPolicy.EXPIRED_TTL && this.isExpired(entry)) return true;
        if (policy === CleanupPolicy.LOW_SCORE && entry.score === MemoryScore.EXPIRED) return true;
        if (policy === CleanupPolicy.ORPHAN_REFERENCES && this.isOrphan(entry, entries)) return true;
        if (request.olderThanMs) {
          const ageMs = Date.now() - entry.updatedAt.getTime();
          if (ageMs > request.olderThanMs) return true;
        }
        return false;
      });

      if (shouldRemove) {
        toRemove.add(entry.id);
        bytesSaved += entry.sizeBytes;
        entriesRemoved++;
      }
    }

    if (!request.dryRun) {
      for (const id of toRemove) this.engine.getEntryMap().delete(id);
    }

    return { entriesRemoved, bytesSaved, snapshotsRemoved, orphansRemoved, durationMs: Date.now() - start, dryRun: !!request.dryRun };
  }

  public isExpired(entry: MemoryEntry): boolean {
    return !!entry.expiresAt && entry.expiresAt < new Date();
  }

  public isOrphan(entry: MemoryEntry, allEntries: MemoryEntry[]): boolean {
    // An orphan is an entry never accessed and with no tags
    return entry.accessCount === 0 && entry.tags.length === 0;
  }
}

// ─── Archive Manager ──────────────────────────────────────────────────────────

class ArchiveManagerImpl implements IArchiveManager {
  private readonly _archives = new Map<string, ArchiveRecord>();
  private readonly _archivedContent = new Map<string, MemoryEntry>(); // archiveId → entries

  constructor(private readonly engine: MemoryOptimizationEngine) {}

  public createArchive(request: ArchiveRequest, entries: MemoryEntry[]): ArchiveResult {
    const start = Date.now();
    const archiveId = `arch-${Date.now()}-${Math.floor(Math.random() * 99999)}`;
    const totalSize = entries.reduce((s, e) => s + e.sizeBytes, 0);
    const compressedSize = Math.floor(totalSize * 0.6); // simulated 40% compression

    const record: ArchiveRecord = {
      id: archiveId,
      label: request.label,
      state: ArchiveState.ARCHIVED,
      entryIds: entries.map(e => e.id),
      projectId: request.projectId,
      workspaceId: request.workspaceId,
      sizeBytes: totalSize,
      compressedSizeBytes: compressedSize,
      version: 1,
      metadata: request.metadata ?? {},
      createdAt: new Date(),
    };

    this._archives.set(archiveId, record);
    for (const e of entries) this._archivedContent.set(`${archiveId}:${e.id}`, e);

    return { archiveId, entriesArchived: entries.length, sizeBytes: totalSize, durationMs: Date.now() - start, success: true };
  }

  public restoreArchive(request: RestoreRequest): RestoreResult {
    const start = Date.now();
    const archive = this._archives.get(request.archiveId);
    if (!archive) {
      return { archiveId: request.archiveId, state: RestoreState.FAILED, entriesRestored: 0, durationMs: Date.now() - start, success: false, error: "Archive not found." };
    }

    archive.state = ArchiveState.RESTORED;
    archive.restoredAt = new Date();

    return { archiveId: request.archiveId, state: RestoreState.COMPLETED, entriesRestored: archive.entryIds.length, durationMs: Date.now() - start, success: true };
  }

  public getArchive(archiveId: string): ArchiveRecord | undefined { return this._archives.get(archiveId); }
  public listArchives(): ArchiveRecord[] { return Array.from(this._archives.values()); }
  public deleteArchive(archiveId: string): void { this._archives.delete(archiveId); }
}

// ─── Retrieval Optimizer ─────────────────────────────────────────────────────

class RetrievalOptimizerImpl implements IRetrievalOptimizer {
  private _cachedIds = new Set<string>();
  private _simulatedLatencyMs = 50;

  constructor(private readonly engine: MemoryOptimizationEngine) {}

  public optimizeIndexes(): IndexOptimizationResult {
    const before = this._simulatedLatencyMs;
    this._simulatedLatencyMs = Math.max(5, Math.floor(before * 0.7));
    return {
      vectorIndexOptimized: true,
      metadataIndexOptimized: true,
      cacheWarmed: this._cachedIds.size > 0,
      retrievalLatencyReducedMs: before - this._simulatedLatencyMs,
      durationMs: 2,
    };
  }

  public warmCache(entries: MemoryEntry[]): void {
    for (const e of entries) this._cachedIds.add(e.id);
  }

  public getRetrievalLatency(): number { return this._simulatedLatencyMs; }
}

// ─── Scoring Manager ─────────────────────────────────────────────────────────

class ScoringManagerImpl implements IScoringManager {
  constructor(private readonly engine: MemoryOptimizationEngine) {}

  public scoreEntry(entry: MemoryEntry): MemoryScoreCard {
    const now = Date.now();
    const ageMs = now - entry.createdAt.getTime();
    const recencyScore = Math.max(0, 1 - ageMs / (30 * 24 * 60 * 60 * 1000)); // Decays over 30 days
    const accessFrequency = Math.min(1, entry.accessCount / 100);
    const importanceScore = entry.score === MemoryScore.CRITICAL ? 1.0 :
                            entry.score === MemoryScore.HIGH ? 0.8 :
                            entry.score === MemoryScore.MEDIUM ? 0.5 :
                            entry.score === MemoryScore.LOW ? 0.3 : 0.1;
    const learningValue = entry.tags.includes("learning") ? 0.9 : 0.5;
    const successRate = entry.metadata?.successRate as number ?? 0.7;
    const founderPreference = entry.metadata?.founderPreference as number ?? 0.5;

    const compositeScore = (
      accessFrequency * 0.25 +
      recencyScore * 0.20 +
      importanceScore * 0.25 +
      learningValue * 0.10 +
      successRate * 0.10 +
      founderPreference * 0.10
    );

    // Update entry score tier
    entry.qualityScore = compositeScore;
    if (compositeScore >= 0.8) entry.score = MemoryScore.CRITICAL;
    else if (compositeScore >= 0.6) entry.score = MemoryScore.HIGH;
    else if (compositeScore >= 0.4) entry.score = MemoryScore.MEDIUM;
    else if (compositeScore >= 0.2) entry.score = MemoryScore.LOW;
    else entry.score = MemoryScore.STALE;

    return {
      entryId: entry.id,
      score: entry.score,
      qualityScore: entry.qualityScore,
      accessFrequency,
      recencyScore,
      importanceScore,
      learningValue,
      successRate,
      founderPreference,
      compositeScore,
      computedAt: new Date(),
    };
  }

  public rescoreAll(entries: MemoryEntry[]): MemoryScoreCard[] {
    return entries.map(e => this.scoreEntry(e));
  }

  public updateAccessStats(entryId: string, entries: MemoryEntry[]): void {
    const e = entries.find(x => x.id === entryId);
    if (e) { e.accessCount++; e.lastAccessedAt = new Date(); }
  }
}

// ─── Ranking Manager ─────────────────────────────────────────────────────────

class RankingManagerImpl implements IRankingManager {
  constructor(private readonly engine: MemoryOptimizationEngine) {}

  public rank(request: RankingRequest): RankingResponse {
    const start = Date.now();
    const topK = request.topK ?? this.engine.getConfig().rankingTopK;

    const ranked: RankedEntry[] = request.entries.map(entry => {
      const semanticSimilarity = this.computeSemanticSimilarity(request.query, entry.content);
      const freshness = this.computeFreshness(entry);
      const confidence = entry.qualityScore;
      const relevanceScore = semanticSimilarity * 0.5 + confidence * 0.3 + freshness * 0.2;
      const projectRelevance = request.projectId && entry.projectId === request.projectId ? 1.0 : 0.5;
      const workspaceRelevance = request.workspaceId && entry.workspaceId === request.workspaceId ? 1.0 : 0.5;
      const decisionWeight = entry.tags.includes("decision") ? 1.2 : 1.0;
      const rankScore = relevanceScore * projectRelevance * workspaceRelevance * decisionWeight;

      const rank = rankScore >= 0.8 ? ContextRank.TOP :
                   rankScore >= 0.6 ? ContextRank.HIGH :
                   rankScore >= 0.4 ? ContextRank.MEDIUM :
                   rankScore >= 0.2 ? ContextRank.LOW : ContextRank.IRRELEVANT;

      return { entry, rank, rankScore, semanticSimilarity, confidence, relevanceScore, freshness, projectRelevance, workspaceRelevance, decisionWeight };
    });

    const sorted = ranked.sort((a, b) => b.rankScore - a.rankScore).slice(0, topK);

    return { query: request.query, ranked: sorted, totalConsidered: request.entries.length, durationMs: Date.now() - start };
  }

  public computeSemanticSimilarity(query: string, content: string): number {
    const qWords = new Set(query.toLowerCase().split(/\s+/));
    const cWords = content.toLowerCase().split(/\s+/);
    const matches = cWords.filter(w => qWords.has(w)).length;
    return Math.min(1, matches / Math.max(1, qWords.size));
  }

  public computeFreshness(entry: MemoryEntry): number {
    const ageMs = Date.now() - entry.updatedAt.getTime();
    const decayMs = 7 * 24 * 60 * 60 * 1000; // 7-day freshness window
    return Math.max(0, 1 - ageMs / decayMs);
  }
}

// ─── Maintenance Scheduler ────────────────────────────────────────────────────

class MaintenanceSchedulerImpl implements IMaintenanceScheduler {
  private _timer?: NodeJS.Timeout;
  private _lastRunAt?: Date;
  private _nextRunAt?: Date;

  constructor(private readonly engine: MemoryOptimizationEngine) {}

  public scheduleNext(delayMs: number): void {
    this._nextRunAt = new Date(Date.now() + delayMs);
    this._timer = setTimeout(async () => {
      this._lastRunAt = new Date();
      this._nextRunAt = undefined;
      this._timer = undefined;
      try {
        await this.engine.runMaintenance();
      } catch { /* suppress */ }
    }, delayMs);
  }

  public cancelScheduled(): void {
    if (this._timer) { clearTimeout(this._timer); this._timer = undefined; this._nextRunAt = undefined; }
  }

  public getLastRunAt(): Date | undefined { return this._lastRunAt; }
  public getNextRunAt(): Date | undefined { return this._nextRunAt; }
  public isScheduled(): boolean { return !!this._timer; }
}

// ─── Reporter ─────────────────────────────────────────────────────────────────

class ReporterImpl implements IMemoryOptimizationReporter {
  constructor(private readonly engine: MemoryOptimizationEngine) {}

  public generateReport(): MemoryOptimizationReport {
    const entries = Array.from(this.engine.getEntryMap().values());
    return {
      timestamp: new Date(),
      state: this.engine.getState(),
      statistics: this._buildStats(entries),
      health: {
        healthy: this.engine.getState() === MemoryOptimizationState.READY,
        compressionReady: true,
        deduplicationReady: true,
        archiveReady: true,
        lastCheckTime: new Date(),
      },
    };
  }

  public getSnapshot(): MemoryOptimizationSnapshot {
    const entries = Array.from(this.engine.getEntryMap().values());
    const archives = this.engine.getArchiveManager().listArchives();
    const snap: MemoryOptimizationSnapshot = {
      timestamp: new Date(),
      state: this.engine.getState(),
      entries,
      archives,
      statistics: this._buildStats(entries),
    };
    const cloned = JSON.parse(JSON.stringify(snap));
    cloned.timestamp = new Date(cloned.timestamp);
    for (const e of cloned.entries) {
      e.createdAt = new Date(e.createdAt);
      e.updatedAt = new Date(e.updatedAt);
      e.lastAccessedAt = new Date(e.lastAccessedAt);
    }
    for (const a of cloned.archives) a.createdAt = new Date(a.createdAt);
    const frozen = deepFreeze(cloned);
    MemoryOptimizationValidator.validateSnapshotImmutability(frozen);
    return frozen;
  }

  private _buildStats(entries: MemoryEntry[]): MemoryOptimizationStatistics {
    return {
      totalEntries: entries.length,
      compressedEntries: entries.filter(e => e.compressed).length,
      totalSizeBytes: entries.reduce((s, e) => s + e.sizeBytes, 0),
      totalCompressedSizeBytes: entries.reduce((s, e) => s + (e.compressedSizeBytes ?? e.sizeBytes), 0),
      duplicatesRemoved: this.engine.getDuplicatesRemoved(),
      archivesCreated: this.engine.getArchiveManager().listArchives().length,
      maintenanceRuns: this.engine.getMaintenanceRuns(),
      uptimeMs: this.engine.getUptimeMs(),
    };
  }
}
