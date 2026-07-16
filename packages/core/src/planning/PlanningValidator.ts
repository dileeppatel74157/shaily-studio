import { Goal } from "./Goal";
import { PlanningStrategy } from "./PlanningStrategy";
import { PlanStatus } from "./PlanStatus";
import { PlanTask } from "./PlanTask";
import { PlanReflection } from "./PlanReflection";
import { PlanExecution } from "./PlanExecution";
import { PlanningState } from "./PlanningState";
import { PlanningValidationException } from "./types";

export class PlanningValidator {
  public static validateGoal(goal: Goal): void {
    if (!goal) {
      throw new PlanningValidationException("Goal cannot be null or undefined.");
    }
    if (!goal.id || goal.id.trim() === "") {
      throw new PlanningValidationException("Goal ID cannot be empty.");
    }
    if (!goal.description || goal.description.trim() === "") {
      throw new PlanningValidationException("Goal description cannot be empty (Empty goal).");
    }
    if (!goal.type) {
      throw new PlanningValidationException("Goal type cannot be empty.");
    }
    if (!goal.priority) {
      throw new PlanningValidationException("Goal priority cannot be empty.");
    }
    this.validatePriorities(goal.priority);
  }

  public static validateTasks(tasks: ReadonlyArray<PlanTask>): void {
    const ids = new Set<string>();
    for (const task of tasks) {
      if (!task.id || task.id.trim() === "") {
        throw new PlanningValidationException("Task ID cannot be empty.");
      }
      if (ids.has(task.id)) {
        throw new PlanningValidationException(`Duplicate task ID detected: ${task.id}`);
      }
      ids.add(task.id);
      if (!task.name || task.name.trim() === "") {
        throw new PlanningValidationException("Task name cannot be empty.");
      }
      if (!task.priority) {
        throw new PlanningValidationException("Task priority cannot be empty.");
      }
      this.validatePriorities(task.priority);
    }
  }

  public static validateCircularDependencies(tasks: ReadonlyArray<PlanTask>): void {
    const adj = new Map<string, string[]>();
    for (const task of tasks) {
      adj.set(task.id, [...(task.dependencies || [])]);
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (node: string): boolean => {
      if (recStack.has(node)) {
        return true; // Cycle detected
      }
      if (visited.has(node)) {
        return false;
      }
      visited.add(node);
      recStack.add(node);

      const neighbors = adj.get(node) || [];
      for (const neighbor of neighbors) {
        if (dfs(neighbor)) {
          return true;
        }
      }
      recStack.delete(node);
      return false;
    };

    for (const task of tasks) {
      if (dfs(task.id)) {
        throw new PlanningValidationException(`Circular dependency detected in tasks.`);
      }
    }
  }

  public static validateStrategy(strategy: PlanningStrategy): void {
    if (!strategy || !Object.values(PlanningStrategy).includes(strategy)) {
      throw new PlanningValidationException(`Invalid strategy: ${strategy}`);
    }
  }

  public static validatePlanStatusTransition(current: PlanStatus, target: PlanStatus): void {
    const allowedTransitions: Record<PlanStatus, PlanStatus[]> = {
      [PlanStatus.CREATED]: [PlanStatus.PLANNING, PlanStatus.READY, PlanStatus.RUNNING, PlanStatus.FAILED, PlanStatus.CANCELLED],
      [PlanStatus.PLANNING]: [PlanStatus.READY, PlanStatus.RUNNING, PlanStatus.FAILED, PlanStatus.CANCELLED],
      [PlanStatus.READY]: [PlanStatus.RUNNING, PlanStatus.CANCELLED, PlanStatus.FAILED],
      [PlanStatus.RUNNING]: [PlanStatus.PAUSED, PlanStatus.COMPLETED, PlanStatus.FAILED, PlanStatus.CANCELLED],
      [PlanStatus.PAUSED]: [PlanStatus.RUNNING, PlanStatus.CANCELLED, PlanStatus.FAILED],
      [PlanStatus.FAILED]: [PlanStatus.READY, PlanStatus.RUNNING, PlanStatus.CREATED, PlanStatus.PLANNING],
      [PlanStatus.COMPLETED]: [PlanStatus.READY, PlanStatus.RUNNING],
      [PlanStatus.CANCELLED]: [PlanStatus.READY, PlanStatus.RUNNING],
    };

    const allowed = allowedTransitions[current] || [];
    if (!allowed.includes(target)) {
      throw new PlanningValidationException(`Invalid PlanStatus transition from ${current} to ${target}`);
    }
  }

  public static validateReflection(reflection: PlanReflection): void {
    if (!reflection) {
      throw new PlanningValidationException("Reflection cannot be null or undefined.");
    }
    if (!reflection.id || reflection.id.trim() === "") {
      throw new PlanningValidationException("Reflection ID cannot be empty (Invalid reflection).");
    }
    if (!reflection.planId || reflection.planId.trim() === "") {
      throw new PlanningValidationException("Reflection Plan ID cannot be empty.");
    }
    if (!reflection.taskId || reflection.taskId.trim() === "") {
      throw new PlanningValidationException("Reflection Task ID cannot be empty.");
    }
  }

  public static validateExecution(execution: PlanExecution): void {
    if (!execution) {
      throw new PlanningValidationException("Execution cannot be null or undefined.");
    }
    if (!execution.id || execution.id.trim() === "") {
      throw new PlanningValidationException("Execution ID cannot be empty (Invalid execution).");
    }
    if (!execution.planId || execution.planId.trim() === "") {
      throw new PlanningValidationException("Execution Plan ID cannot be empty.");
    }
  }

  public static validatePriorities(priority: string): void {
    const valid = ["CRITICAL", "HIGH", "NORMAL", "LOW", "BACKGROUND"];
    if (!valid.includes(priority)) {
      throw new PlanningValidationException(`Invalid priority: ${priority}`);
    }
  }

  public static validateLifecycle(current: PlanningState, target: PlanningState): void {
    const allowedTransitions: Record<PlanningState, PlanningState[]> = {
      [PlanningState.CREATED]: [PlanningState.READY, PlanningState.FAILED],
      [PlanningState.READY]: [PlanningState.RUNNING, PlanningState.STOPPED, PlanningState.FAILED],
      [PlanningState.RUNNING]: [PlanningState.STOPPED, PlanningState.FAILED],
      [PlanningState.STOPPED]: [PlanningState.READY, PlanningState.RUNNING],
      [PlanningState.FAILED]: [PlanningState.READY, PlanningState.RUNNING],
    };

    const allowed = allowedTransitions[current] || [];
    if (!allowed.includes(target)) {
      throw new PlanningValidationException(`Invalid lifecycle transition from ${current} to ${target}`);
    }
  }
}
