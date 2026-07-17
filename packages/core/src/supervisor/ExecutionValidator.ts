import { ExecutionState } from "./ExecutionState";
import { ExecutionCheckpoint } from "./ExecutionCheckpoint";
import { ExecutionPolicy } from "./ExecutionPolicy";
import { ExecutionRecovery } from "./ExecutionRecovery";
import { SupervisorValidationException } from "./types";

export class ExecutionValidator {
  public static validateTransition(current: ExecutionState, target: ExecutionState): void {
    const invalidTransitions: Record<ExecutionState, ExecutionState[]> = {
      [ExecutionState.CREATED]: [ExecutionState.COMPLETED, ExecutionState.FAILED],
      [ExecutionState.READY]: [ExecutionState.COMPLETED],
      [ExecutionState.RUNNING]: [],
      [ExecutionState.PAUSED]: [],
      [ExecutionState.RECOVERING]: [],
      [ExecutionState.COMPLETED]: [ExecutionState.RUNNING, ExecutionState.PAUSED, ExecutionState.READY, ExecutionState.RECOVERING],
      [ExecutionState.FAILED]: [ExecutionState.RUNNING, ExecutionState.PAUSED, ExecutionState.READY],
      [ExecutionState.CANCELLED]: [ExecutionState.RUNNING, ExecutionState.PAUSED, ExecutionState.READY, ExecutionState.RECOVERING],
      [ExecutionState.TIMEOUT]: [ExecutionState.RUNNING, ExecutionState.PAUSED, ExecutionState.READY, ExecutionState.RECOVERING],
    };

    const forbidden = invalidTransitions[current] || [];
    if (forbidden.includes(target)) {
      throw new SupervisorValidationException(
        `Invalid execution state transition from "${current}" to "${target}".`
      );
    }
  }

  public static validateCheckpoint(checkpoint: ExecutionCheckpoint): void {
    if (!checkpoint.id || !checkpoint.sessionId) {
      throw new SupervisorValidationException("Checkpoint must have a valid ID and sessionId.");
    }
    if (checkpoint.progress < 0 || checkpoint.progress > 100) {
      throw new SupervisorValidationException(`Invalid progress: ${checkpoint.progress}. Must be 0-100.`);
    }
    if (!checkpoint.variables) {
      throw new SupervisorValidationException("Checkpoint variables cannot be undefined.");
    }
  }

  public static validatePolicy(policy: ExecutionPolicy): void {
    if (!policy.id || !policy.name) {
      throw new SupervisorValidationException("Execution policy must have id and name.");
    }
    if (policy.limits.maxTokens < 0 || policy.limits.maxCost < 0 || policy.limits.maxExecutionTimeMs < 0) {
      throw new SupervisorValidationException("Budget limits must be positive numbers.");
    }
    if (policy.limits.maxRetries < 0 || policy.limits.maxRecursion < 0) {
      throw new SupervisorValidationException("Limit ceilings must be positive integers.");
    }
  }

  public static validateCircularRecovery(recoveries: ReadonlyArray<ExecutionRecovery>): void {
    const adj = new Map<string, string>();
    for (const rec of recoveries) {
      if (rec.dependsOnRecoveryId) {
        adj.set(rec.id, rec.dependsOnRecoveryId);
      }
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const checkCycle = (node: string) => {
      if (recStack.has(node)) {
        throw new SupervisorValidationException(`Circular recovery dependency chain detected: path contains ${node}`);
      }
      if (!visited.has(node)) {
        visited.add(node);
        recStack.add(node);
        const dep = adj.get(node);
        if (dep) {
          checkCycle(dep);
        }
        recStack.delete(node);
      }
    };

    for (const rec of recoveries) {
      checkCycle(rec.id);
    }
  }
}
