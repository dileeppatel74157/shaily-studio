import { IMemoryEngine } from "./IMemoryEngine";
import { MemoryContext } from "./MemoryContext";
import { MemoryConfiguration } from "./MemoryBuilder";
import { MemoryState } from "./MemoryState";
import { MemoryEntry } from "./MemoryEntry";
import { MemorySearch } from "./MemorySearch";
import { MemorySearchResult } from "./MemorySearchResult";
import { MemorySnapshot } from "./MemorySnapshot";
import { LearningRecord } from "./LearningRecord";
import { LearningPattern } from "./LearningPattern";
import { Reflection } from "./Reflection";
import { MemoryValidator } from "./MemoryValidator";
import { MemoryType } from "./MemoryType";
import { MemoryScope } from "./MemoryScope";
import { MemoryImportance } from "./MemoryImportance";
import { deepFreeze, MemoryValidationException, InvalidMemoryStateException } from "./types";

export class MemoryEngine implements IMemoryEngine {
  private _state = MemoryState.CREATED;
  private readonly _memories = new Map<string, MemoryEntry>();
  private readonly _learningRecords = new Map<string, LearningRecord>();
  private readonly _patterns = new Map<string, LearningPattern>();
  private readonly _reflections = new Map<string, Reflection>();
  private readonly _cache = new Map<string, any>();
  private readonly _validator = new MemoryValidator();

  private readonly importanceLevels: Record<MemoryImportance, number> = {
    LOW: 1,
    NORMAL: 2,
    HIGH: 3,
    CRITICAL: 4,
    PERMANENT: 5,
  };

  constructor(
    public readonly context: MemoryContext,
    public readonly configuration?: MemoryConfiguration,
    public readonly metadata: Record<string, unknown> = {}
  ) {}

  public async initialize(): Promise<void> {
    this._validator.validateStateTransition(this._state, MemoryState.READY);
    this._state = MemoryState.READY;
    this.context.logger.info("MemoryEngine initialized");
  }

  public async start(): Promise<void> {
    this._validator.validateStateTransition(this._state, MemoryState.RUNNING);
    this._state = MemoryState.RUNNING;
    this.context.logger.info("MemoryEngine started");
  }

  public async stop(): Promise<void> {
    this._validator.validateStateTransition(this._state, MemoryState.STOPPED);
    this._state = MemoryState.STOPPED;
    this.context.logger.info("MemoryEngine stopped");
  }

  public async store(
    entry: Omit<MemoryEntry, "id" | "timestamp" | "value" | "createdAt" | "updatedAt" | "version">
  ): Promise<MemoryEntry> {
    if (this._state !== MemoryState.RUNNING) {
      throw new InvalidMemoryStateException("store", this._state);
    }

    const id = "mem-" + Math.random().toString(36).substring(2, 11);
    const validatedEntry = {
      id,
      content: entry.content,
      type: entry.type,
      scope: entry.scope,
      importance: entry.importance,
    };

    this._validator.validateEntry(validatedEntry);
    this._validator.validateCircularReferences(entry.metadata);

    const memory = new MemoryEntry(
      id,
      entry.key || "",
      entry.namespace || "",
      entry.type,
      entry.scope,
      entry.importance,
      entry.content,
      entry.tags || [],
      entry.metadata || {},
      entry.content,
      new Date(),
      new Date(),
      1
    );

    this._memories.set(id, memory);

    // Save to Cache if Temporary Cache scope
    if (entry.scope === "SESSION") {
      this._cache.set(id, memory);
    }

    if (this.context.eventBus) {
      await this.context.eventBus.publish({
        id: "evt-" + Math.random().toString(36).substring(2, 11),
        name: "MemoryStored",
        timestamp: new Date(),
        correlationId: "corr-memory",
        source: "MemoryEngine",
        payload: { memoryId: id },
        metadata: {},
      });
    }

    return memory;
  }

  public async update(id: string, updateData: Partial<MemoryEntry>): Promise<MemoryEntry> {
    if (this._state !== MemoryState.RUNNING) {
      throw new InvalidMemoryStateException("update", this._state);
    }

    const existing = this._memories.get(id);
    if (!existing) {
      throw new MemoryValidationException(`Memory with ID ${id} not found.`);
    }

    if (updateData.metadata) {
      this._validator.validateCircularReferences(updateData.metadata);
    }

    const updated = new MemoryEntry(
      id,
      updateData.key !== undefined ? updateData.key : existing.key,
      updateData.namespace !== undefined ? updateData.namespace : existing.namespace,
      updateData.type !== undefined ? updateData.type : existing.type,
      updateData.scope !== undefined ? updateData.scope : existing.scope,
      updateData.importance !== undefined ? updateData.importance : existing.importance,
      updateData.content !== undefined ? updateData.content : existing.content,
      updateData.tags !== undefined ? updateData.tags : existing.tags,
      updateData.metadata !== undefined ? updateData.metadata : existing.metadata,
      updateData.value !== undefined ? updateData.value : existing.value,
      existing.createdAt,
      new Date(),
      existing.version + 1
    );

    this._memories.set(id, updated);
    return updated;
  }

  public async delete(id: string): Promise<boolean> {
    if (this._state !== MemoryState.RUNNING) {
      throw new InvalidMemoryStateException("delete", this._state);
    }

    const deleted = this._memories.delete(id);
    this._cache.delete(id);
    return deleted;
  }

  public async retrieve(id: string): Promise<MemoryEntry | undefined> {
    if (this._state !== MemoryState.RUNNING) {
      throw new InvalidMemoryStateException("retrieve", this._state);
    }
    return this._memories.get(id);
  }

  public async search(criteria: MemorySearch): Promise<ReadonlyArray<MemorySearchResult>> {
    if (this._state !== MemoryState.RUNNING) {
      throw new InvalidMemoryStateException("search", this._state);
    }

    const results: MemorySearchResult[] = [];
    for (const entry of this._memories.values()) {
      // 1. Tag filtering
      if (criteria.tags && criteria.tags.length > 0) {
        const matchesTags = criteria.tags.every((t) => entry.tags.includes(t));
        if (!matchesTags) continue;
      }

      // 2. Types filtering
      if (criteria.types && criteria.types.length > 0) {
        if (!criteria.types.includes(entry.type)) continue;
      }

      // 3. Scopes filtering
      if (criteria.scopes && criteria.scopes.length > 0) {
        if (!criteria.scopes.includes(entry.scope)) continue;
      }

      // 4. Importance filtering
      if (criteria.minImportance) {
        const minLvl = this.importanceLevels[criteria.minImportance];
        const entryLvl = this.importanceLevels[entry.importance];
        if (entryLvl < minLvl) continue;
      }

      // 5. Agent filtering
      if (criteria.agentId) {
        if (entry.metadata.agentId !== criteria.agentId) continue;
      }

      // 6. Conversation filtering
      if (criteria.conversationId) {
        if (entry.metadata.conversationId !== criteria.conversationId) continue;
      }

      // 7. Time filtering
      if (criteria.startTime && entry.timestamp < criteria.startTime) continue;
      if (criteria.endTime && entry.timestamp > criteria.endTime) continue;

      // 8. Query Score calculation
      let score = 0;
      if (criteria.query) {
        const matchesQuery = entry.content.toLowerCase().includes(criteria.query.toLowerCase());
        if (matchesQuery) {
          score += 10;
        } else {
          continue; // Query specified but no match
        }
      }

      // Compute metadata relevance addition
      if (criteria.tags) {
        const intersection = entry.tags.filter((t) => criteria.tags?.includes(t));
        score += intersection.length * 2;
      }

      // Add importance level to score
      score += this.importanceLevels[entry.importance] || 0;

      results.push({ entry, score });
    }

    // Sort Results: Score Descending, then Timestamp Descending
    results.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.entry.timestamp.getTime() - a.entry.timestamp.getTime();
    });

    return deepFreeze(results);
  }

  public async summarize(scope: string): Promise<string> {
    if (this._state !== MemoryState.RUNNING) {
      throw new InvalidMemoryStateException("summarize", this._state);
    }
    const filtered = Array.from(this._memories.values()).filter((e) => e.scope === scope);
    return `Memory Summary for scope ${scope}: Total count is ${filtered.length}. Content includes: [${filtered
      .map((e) => e.content)
      .join("; ")}]`;
  }

  public async reflect(executionId: string, output: unknown): Promise<Reflection> {
    if (this._state !== MemoryState.RUNNING) {
      throw new InvalidMemoryStateException("reflect", this._state);
    }

    const id = "refl-" + Math.random().toString(36).substring(2, 11);
    const reflection: Reflection = deepFreeze({
      id,
      executionId,
      lessons: ["Reflection lesson learned."],
      mistakes: ["Reflection mistake recorded."],
      optimizations: ["Reflection optimization proposal."],
      recommendations: ["Reflection execution recommendation."],
      timestamp: new Date(),
    });

    this._reflections.set(id, reflection);

    if (this.context.eventBus) {
      await this.context.eventBus.publish({
        id: "evt-" + Math.random().toString(36).substring(2, 11),
        name: "ReflectionCreated",
        timestamp: new Date(),
        correlationId: "corr-memory",
        source: "MemoryEngine",
        payload: { reflectionId: id, executionId },
        metadata: {},
      });
    }

    return reflection;
  }

  public async learn(sourceId: string, details: Record<string, unknown>): Promise<LearningRecord> {
    if (this._state !== MemoryState.RUNNING) {
      throw new InvalidMemoryStateException("learn", this._state);
    }

    const id = "learn-" + Math.random().toString(36).substring(2, 11);
    const record: LearningRecord = deepFreeze({
      id,
      sourceId,
      sourceType: (details.sourceType as any) || "execution",
      description: (details.description as string) || "Learning description",
      lessons: (details.lessons as string[]) || ["Learning lesson learned."],
      timestamp: new Date(),
    });

    this._learningRecords.set(id, record);

    // Learning Pattern Detection
    if (details.outcome === "failure") {
      const existingFailures = Array.from(this._learningRecords.values()).filter(
        (r) => r.sourceId === sourceId && r.sourceType === "failure"
      );
      if (existingFailures.length >= 2) {
        const patternId = "pat-" + Math.random().toString(36).substring(2, 11);
        const pattern: LearningPattern = deepFreeze({
          id: patternId,
          name: "Repeated Failure Pattern",
          type: "repeated-failure",
          description: "Multiple failures detected on source: " + sourceId,
          confidence: 0.95,
          occurrences: existingFailures.length + 1,
          timestamp: new Date(),
        });
        this._patterns.set(patternId, pattern);
      }
    } else if (details.bottleneck === true) {
      const patternId = "pat-" + Math.random().toString(36).substring(2, 11);
      const pattern: LearningPattern = deepFreeze({
        id: patternId,
        name: "Execution Bottleneck Pattern",
        type: "execution-bottleneck",
        description: "Task execution delay bottleneck identified.",
        confidence: 0.85,
        occurrences: 1,
        timestamp: new Date(),
      });
      this._patterns.set(patternId, pattern);
    }

    if (this.context.eventBus) {
      await this.context.eventBus.publish({
        id: "evt-" + Math.random().toString(36).substring(2, 11),
        name: "LearningRecordCreated",
        timestamp: new Date(),
        correlationId: "corr-memory",
        source: "MemoryEngine",
        payload: { learningId: id, sourceId },
        metadata: {},
      });
    }

    return record;
  }

  public snapshot(): MemorySnapshot {
    return deepFreeze({
      timestamp: new Date(),
      state: this._state,
      learningCount: this._learningRecords.size,
      memoryCount: this._memories.size,
      patternCount: this._patterns.size,
      reflectionCount: this._reflections.size,
      cacheUsage: this._cache.size,
    });
  }
}
