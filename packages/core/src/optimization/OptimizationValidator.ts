import { OptimizationState }             from "./OptimizationState";
import { OptimizationTarget }            from "./OptimizationTarget";
import { OptimizationPriority }          from "./OptimizationPriority";
import { OptimizationStatus }            from "./OptimizationStatus";
import { OptimizationValidationException } from "./types";
import type {
  OptimizationRequest,
  OptimizationRule,
  OptimizationCandidate,
  OptimizationExecution,
  OptimizationImpact,
  OptimizationSnapshot,
} from "./models";

const STATE_TRANSITIONS: Record<OptimizationState, OptimizationState[]> = {
  [OptimizationState.CREATED]:     [OptimizationState.INITIALIZED],
  [OptimizationState.INITIALIZED]: [OptimizationState.RUNNING, OptimizationState.FAILED],
  [OptimizationState.RUNNING]:     [OptimizationState.PAUSED, OptimizationState.COMPLETED, OptimizationState.FAILED],
  [OptimizationState.PAUSED]:      [OptimizationState.RUNNING, OptimizationState.FAILED],
  [OptimizationState.COMPLETED]:   [OptimizationState.INITIALIZED],
  [OptimizationState.FAILED]:      [OptimizationState.INITIALIZED],
  [OptimizationState.CANCELLED]:   [OptimizationState.INITIALIZED],
};

export class OptimizationValidator {

  // Validation 1: State transitions
  public static validateStateTransition(id: string, from: OptimizationState, to: OptimizationState): void {
    const allowed = STATE_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new OptimizationValidationException(`Invalid state transition for ${id}: ${from} -> ${to}`);
    }
  }

  // Validation 2: Duplicate rules
  public static validateNoDuplicateRules(rules: OptimizationRule[]): void {
    const seen = new Set<string>();
    for (const r of rules) {
      if (seen.has(r.id)) {
        throw new OptimizationValidationException(`Duplicate optimization rule ID: ${r.id}`);
      }
      seen.add(r.id);
    }
  }

  // Validation 3: Invalid scores
  public static validateScores(candidate: OptimizationCandidate): void {
    if (candidate.confidenceScore < 0 || candidate.confidenceScore > 1) {
      throw new OptimizationValidationException(`confidenceScore must be between 0 and 1: ${candidate.confidenceScore}`);
    }
    if (candidate.expectedImprovementPercent < -100 || candidate.expectedImprovementPercent > 1000) {
      throw new OptimizationValidationException(`expectedImprovementPercent out of bounds: ${candidate.expectedImprovementPercent}`);
    }
  }

  // Validation 4: Circular optimizations / Dependency graph loops
  public static validateNoCircularRules(rules: OptimizationRule[]): void {
    const adj = new Map<string, string[]>();
    for (const rule of rules) {
      adj.set(rule.id, rule.dependencies);
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

    for (const rule of rules) {
      if (dfs(rule.id)) {
        throw new OptimizationValidationException(`Circular dependency detected in optimization rules! Loop node: ${rule.id}`);
      }
    }
  }

  // Validation 5: Conflicting optimizations
  public static validateNoConflictingOptimizations(candidates: OptimizationCandidate[]): void {
    const targetMap = new Map<OptimizationTarget, string>();
    for (const c of candidates) {
      const existingProposal = targetMap.get(c.target);
      const proposedStr = JSON.stringify(c.proposedValue);
      if (existingProposal && existingProposal !== proposedStr) {
        throw new OptimizationValidationException(
          `Conflicting optimizations detected for target ${c.target}. Proposing multiple incompatible values.`
        );
      }
      targetMap.set(c.target, proposedStr);
    }
  }

  // Validation 6: Missing dependencies
  public static validateRuleDependencies(rules: OptimizationRule[]): void {
    const ids = new Set(rules.map(r => r.id));
    for (const r of rules) {
      for (const dep of r.dependencies) {
        if (!ids.has(dep)) {
          throw new OptimizationValidationException(`Rule ${r.id} depends on missing rule: ${dep}`);
        }
      }
    }
  }

  // Validation 7: Invalid rollback paths
  public static validateRollback(execution: OptimizationExecution): void {
    if (execution.status === OptimizationStatus.ROLLED_BACK && (!execution.rollbackPath || execution.rollbackPath.trim() === "")) {
      throw new OptimizationValidationException(`Rolled back execution ${execution.id} must specify a rollback path`);
    }
  }

  // Validation 8: Invalid impact metrics
  public static validateImpactMetrics(impact: OptimizationImpact): void {
    if (Number.isNaN(impact.metricDiffPercent)) {
      throw new OptimizationValidationException(`Impact metricDiffPercent must be a valid number`);
    }
    if (impact.costDiffUsd > 10_000) {
      throw new OptimizationValidationException(`Impact costDiffUsd is excessively high: ${impact.costDiffUsd}`);
    }
  }

  // Validation 9: Snapshot integrity
  public static validateSnapshotIntegrity(snap: OptimizationSnapshot): void {
    if (!snap.id || snap.id.trim() === "") {
      throw new OptimizationValidationException("OptimizationSnapshot must have a valid ID");
    }
    if (snap.timestamp > new Date(Date.now() + 3600_000)) {
      throw new OptimizationValidationException("Snapshot timestamp cannot be in the future");
    }
  }

  // Validation 10: Invalid targets
  public static validateRequest(req: OptimizationRequest): void {
    if (!req.id || req.id.trim() === "") {
      throw new OptimizationValidationException("OptimizationRequest must have a valid ID");
    }
    if (!req.targets || req.targets.length === 0) {
      throw new OptimizationValidationException("OptimizationRequest targets cannot be empty");
    }
    for (const t of req.targets) {
      if (!Object.values(OptimizationTarget).includes(t)) {
        throw new OptimizationValidationException(`Invalid target value in request: ${t}`);
      }
    }
  }
}
