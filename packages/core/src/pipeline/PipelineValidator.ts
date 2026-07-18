import { PipelineState }             from "./PipelineState";
import { PipelineStage }             from "./PipelineStage";
import { PipelineStatus }            from "./PipelineStatus";
import { PipelineValidationException } from "./types";
import type {
  PipelineRequest,
  PipelineCheckpoint,
  PipelineRecovery,
  PipelineSnapshot,
} from "./models";

const STATE_TRANSITIONS: Record<PipelineState, PipelineState[]> = {
  [PipelineState.CREATED]:     [PipelineState.INITIALIZED],
  [PipelineState.INITIALIZED]: [PipelineState.RUNNING, PipelineState.FAILED],
  [PipelineState.RUNNING]:     [PipelineState.PAUSED, PipelineState.COMPLETED, PipelineState.FAILED],
  [PipelineState.PAUSED]:      [PipelineState.RUNNING, PipelineState.FAILED],
  [PipelineState.COMPLETED]:   [PipelineState.INITIALIZED],
  [PipelineState.FAILED]:      [PipelineState.INITIALIZED],
  [PipelineState.CANCELLED]:   [PipelineState.INITIALIZED],
};

export class PipelineValidator {

  // Validation 1: State transitions
  public static validateStateTransition(id: string, from: PipelineState, to: PipelineState): void {
    const allowed = STATE_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new PipelineValidationException(`Invalid state transition for ${id}: ${from} -> ${to}`);
    }
  }

  // Validation 2: Duplicate stages
  public static validateNoDuplicateStages(stages: PipelineStage[]): void {
    const seen = new Set<PipelineStage>();
    for (const s of stages) {
      if (seen.has(s)) {
        throw new PipelineValidationException(`Duplicate stage found in request: ${s}`);
      }
      seen.add(s);
    }
  }

  // Validation 3: Circular execution graph / Dependency graph validation
  public static validateNoCircularStages(edges: [PipelineStage, PipelineStage][]): void {
    const adj = new Map<PipelineStage, PipelineStage[]>();
    for (const [from, to] of edges) {
      const list = adj.get(from) ?? [];
      list.push(to);
      adj.set(from, list);
    }

    const visited = new Set<PipelineStage>();
    const recStack = new Set<PipelineStage>();

    const dfs = (node: PipelineStage): boolean => {
      if (recStack.has(node)) return true;
      if (visited.has(node)) return false;

      visited.add(node);
      recStack.add(node);

      const neighbors = adj.get(node) ?? [];
      for (const neighbor of neighbors) {
        if (dfs(neighbor)) return true;
      }

      recStack.delete(node);
      return false;
    };

    for (const node of adj.keys()) {
      if (dfs(node)) {
        throw new PipelineValidationException("Circular execution dependency detected in pipeline stages graph!");
      }
    }
  }

  // Validation 4: Invalid checkpoint
  public static validateCheckpoint(checkpoint: PipelineCheckpoint): void {
    if (!checkpoint.id || checkpoint.id.trim() === "") {
      throw new PipelineValidationException("PipelineCheckpoint must have a valid ID");
    }
    if (!checkpoint.requestId || checkpoint.requestId.trim() === "") {
      throw new PipelineValidationException("PipelineCheckpoint must declare a requestId");
    }
    if (!Object.values(PipelineStage).includes(checkpoint.lastCompletedStage)) {
      throw new PipelineValidationException(`Invalid lastCompletedStage: ${checkpoint.lastCompletedStage}`);
    }
  }

  // Validation 5: Invalid recovery
  public static validateRecovery(recovery: PipelineRecovery): void {
    if (!recovery.id || recovery.id.trim() === "") {
      throw new PipelineValidationException("PipelineRecovery must have a valid ID");
    }
    if (!recovery.failureId || recovery.failureId.trim() === "") {
      throw new PipelineValidationException("PipelineRecovery must declare failureId");
    }
  }

  // Validation 6: Orphan stages
  public static validateOrphanStages(stages: PipelineStage[], edges: [PipelineStage, PipelineStage][]): void {
    if (stages.length > 1 && edges.length === 0) {
      throw new PipelineValidationException("Orphan stages detected: Multi-stage pipeline has no execution paths");
    }
  }

  // Validation 7: Dependency validation
  public static validateDependenciesPresent(stages: PipelineStage[], dependencies: Record<PipelineStage, PipelineStage[]>): void {
    const stageSet = new Set(stages);
    for (const [stage, deps] of Object.entries(dependencies)) {
      if (stageSet.has(stage as PipelineStage)) {
        for (const dep of deps) {
          if (!stageSet.has(dep)) {
            throw new PipelineValidationException(`Stage ${stage} depends on missing stage: ${dep}`);
          }
        }
      }
    }
  }

  // Validation 8: Timeout validation
  public static validateTimeout(timeoutMs: number): void {
    if (timeoutMs < 0) {
      throw new PipelineValidationException(`Pipeline timeout duration cannot be negative: ${timeoutMs}`);
    }
    if (timeoutMs > 86400 * 1000) {
      throw new PipelineValidationException(`Pipeline timeout exceeds maximum threshold (24 hours): ${timeoutMs}`);
    }
  }

  // Validation 9: Snapshot integrity
  public static validateSnapshotIntegrity(snap: PipelineSnapshot): void {
    if (!snap.id || snap.id.trim() === "") {
      throw new PipelineValidationException("PipelineSnapshot must have a valid ID");
    }
    if (snap.timestamp > new Date(Date.now() + 3600_000)) {
      throw new PipelineValidationException("Snapshot timestamp cannot be in the future");
    }
  }

  // Validation 10: Missing engines validation
  public static validateRequiredEnginesPresent(ctx: any): void {
    const requiredEngines = [
      "researchEngine", "strategyEngine", "channelEngine", "scriptEngine",
      "productionEngine", "generationEngine", "compositionEngine", "renderEngine",
      "qualityEngine", "publishingEngine", "analyticsEngine", "channelManager",
      "founderEngine", "controlCenterEngine", "learningEngine", "optimizationEngine",
    ];
    for (const eng of requiredEngines) {
      if (!ctx || !ctx[eng]) {
        throw new PipelineValidationException(`Missing required connected engine: ${eng}`);
      }
    }
  }
}
