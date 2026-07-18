import { LearningState }              from "./LearningState";
import { PatternConfidence }          from "./PatternConfidence";
import { RecommendationPriority }     from "./RecommendationPriority";
import { KnowledgeType }              from "./KnowledgeType";
import { ImprovementTarget }          from "./ImprovementTarget";
import { LearningValidationException } from "./types";
import type {
  LearningRequest,
  LearningPattern,
  KnowledgeEntry,
  Recommendation,
  LearningHistory,
  LearningSnapshot,
} from "./models";

const STATE_TRANSITIONS: Record<LearningState, LearningState[]> = {
  [LearningState.CREATED]:     [LearningState.INITIALIZED],
  [LearningState.INITIALIZED]: [LearningState.COLLECTING, LearningState.FAILED],
  [LearningState.COLLECTING]:  [LearningState.ANALYZING, LearningState.CANCELLED, LearningState.FAILED],
  [LearningState.ANALYZING]:   [LearningState.LEARNING, LearningState.CANCELLED, LearningState.FAILED],
  [LearningState.LEARNING]:    [LearningState.APPLYING, LearningState.CANCELLED, LearningState.FAILED],
  [LearningState.APPLYING]:    [LearningState.COMPLETED, LearningState.CANCELLED, LearningState.FAILED],
  [LearningState.COMPLETED]:   [LearningState.INITIALIZED],
  [LearningState.FAILED]:      [LearningState.INITIALIZED],
  [LearningState.CANCELLED]:   [LearningState.INITIALIZED],
};

export class LearningValidator {

  // Validation 1: State transitions
  public static validateStateTransition(id: string, from: LearningState, to: LearningState): void {
    const allowed = STATE_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new LearningValidationException(`Invalid state transition for ${id}: ${from} -> ${to}`);
    }
  }

  public static validateLearningRequest(req: LearningRequest): void {
    if (!req.id || req.id.trim() === "") {
      throw new LearningValidationException("LearningRequest must have a valid ID");
    }
  }

  // Validation 2: Duplicate knowledge entries
  public static validateNoDuplicateKnowledgeEntries(entries: KnowledgeEntry[]): void {
    const seen = new Set<string>();
    for (const e of entries) {
      if (seen.has(e.id)) {
        throw new LearningValidationException(`Duplicate knowledge entry ID: ${e.id}`);
      }
      seen.add(e.id);
    }
  }

  // Validation 3: Invalid confidence
  public static validateConfidence(conf: PatternConfidence): void {
    if (!Object.values(PatternConfidence).includes(conf)) {
      throw new LearningValidationException(`Invalid PatternConfidence value: ${conf}`);
    }
  }

  // Validation 4: Invalid recommendation
  public static validateRecommendation(rec: Recommendation): void {
    if (!rec.id || rec.id.trim() === "") {
      throw new LearningValidationException("Recommendation must have a valid ID");
    }
    if (!rec.title || rec.title.trim() === "") {
      throw new LearningValidationException("Recommendation must have a non-empty title");
    }
    if (!Object.values(ImprovementTarget).includes(rec.target)) {
      throw new LearningValidationException(`Invalid recommendation target: ${rec.target}`);
    }
  }

  // Validation 5: Circular knowledge references
  public static validateNoCircularKnowledgeReferences(entries: KnowledgeEntry[]): void {
    const adj = new Map<string, string[]>();
    for (const entry of entries) {
      adj.set(entry.id, entry.dependencies);
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (node: string): boolean => {
      if (recStack.has(node)) return true;
      if (visited.has(node)) return false;

      visited.add(node);
      recStack.add(node);

      const deps = adj.get(node) ?? [];
      for (const dep of deps) {
        if (dfs(dep)) return true;
      }

      recStack.delete(node);
      return false;
    };

    for (const entry of entries) {
      if (dfs(entry.id)) {
        throw new LearningValidationException(`Circular dependency detected in knowledge base! Node: ${entry.id}`);
      }
    }
  }

  // Validation 6: Empty datasets
  public static validateDatasetNotEmpty(history: LearningHistory[]): void {
    if (!history || history.length === 0) {
      throw new LearningValidationException("Dataset cannot be empty. Must have at least one history entry.");
    }
  }

  // Validation 7: Invalid metrics
  public static validateHistoryEntry(entry: LearningHistory): void {
    if (entry.durationMs < 0) {
      throw new LearningValidationException(`History entry ${entry.id} has negative duration: ${entry.durationMs}`);
    }
    if (entry.costUsd < 0) {
      throw new LearningValidationException(`History entry ${entry.id} has negative cost: ${entry.costUsd}`);
    }
  }

  // Validation 8: Duplicate patterns
  public static validateNoDuplicatePatterns(patterns: LearningPattern[]): void {
    const seen = new Set<string>();
    for (const p of patterns) {
      if (seen.has(p.id)) {
        throw new LearningValidationException(`Duplicate pattern ID: ${p.id}`);
      }
      seen.add(p.id);
    }
  }

  // Validation 9: Orphan recommendations
  public static validateOrphanRecommendations(recs: Recommendation[], patterns: LearningPattern[]): void {
    const patternIds = new Set(patterns.map(p => p.id));
    for (const rec of recs) {
      const sourcePatternId = rec.parameters.patternId as string;
      if (sourcePatternId && !patternIds.has(sourcePatternId)) {
        throw new LearningValidationException(`Orphan recommendation ${rec.id} references non-existent pattern: ${sourcePatternId}`);
      }
    }
  }

  // Validation 10: Snapshot integrity
  public static validateSnapshotIntegrity(snap: LearningSnapshot): void {
    if (!snap.id || snap.id.trim() === "") {
      throw new LearningValidationException("LearningSnapshot must have a valid ID");
    }
    if (!snap.timestamp || snap.timestamp > new Date(Date.now() + 3600_000)) {
      throw new LearningValidationException("LearningSnapshot timestamp cannot be in the future");
    }
  }
}
