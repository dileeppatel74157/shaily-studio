import { SchedulerState } from "./SchedulerState";
import { TaskState } from "./TaskState";
import { TaskPriority } from "./TaskPriority";
import { TriggerType } from "./TriggerType";
import { ScheduleType } from "./ScheduleType";
import { RetryPolicy } from "./RetryPolicy";
import { DependencyState } from "./DependencyState";
import { ExecutionWindow } from "./ExecutionWindow";
import {
  TaskSchedulerValidationException,
  InvalidTaskSchedulerStateException,
  CronParseException
} from "./types";
import {
  ScheduledTask,
  ScheduleRule,
  CronSchedule,
  RetryPolicyConfig,
  QueueItem,
  SchedulerSnapshot,
  TimeWindow,
  TaskExecution
} from "./models";

export class TaskSchedulerValidator {
  /**
   * 1. Validate Identifier syntax.
   */
  public static validateIdentifier(id: string, label: string): void {
    if (!id || typeof id !== "string") {
      throw new TaskSchedulerValidationException(`${label} must be a non-empty string.`);
    }
    const regex = /^[a-zA-Z0-9_\-]+$/;
    if (!regex.test(id)) {
      throw new TaskSchedulerValidationException(`${label} "${id}" contains illegal characters or spaces.`);
    }
  }

  /**
   * 2. Validate Task ID.
   */
  public static validateTaskId(id: string): void {
    this.validateIdentifier(id, "Task ID");
  }

  /**
   * 3. Validate Schedule ID.
   */
  public static validateScheduleId(id: string): void {
    this.validateIdentifier(id, "Schedule ID");
  }

  /**
   * 4. Validate Cron Expression.
   */
  public static validateCronExpression(expression: string): void {
    if (!expression || typeof expression !== "string") {
      throw new CronParseException(expression, "Cron expression must be a non-empty string.");
    }
    const fields = expression.trim().split(/\s+/);
    if (fields.length !== 5) {
      throw new CronParseException(expression, "Must contain exactly 5 space-separated fields.");
    }

    const validateField = (field: string, min: number, max: number, label: string) => {
      if (field === "*") return;
      const parts = field.split(",");
      for (const part of parts) {
        if (part.startsWith("*/")) {
          const step = parseInt(part.substring(2));
          if (isNaN(step) || step <= 0) {
            throw new CronParseException(expression, `Invalid step in ${label}: "${part}"`);
          }
          continue;
        }
        if (part.includes("-")) {
          const rangeParts = part.split("-");
          if (rangeParts.length !== 2) {
            throw new CronParseException(expression, `Invalid range in ${label}: "${part}"`);
          }
          const start = parseInt(rangeParts[0]);
          const end = parseInt(rangeParts[1]);
          if (isNaN(start) || isNaN(end) || start < min || end > max || start > end) {
            throw new CronParseException(expression, `Range bounds out of range in ${label}: "${part}"`);
          }
          continue;
        }
        const val = parseInt(part);
        if (isNaN(val) || val < min || val > max) {
          throw new CronParseException(expression, `Value out of bounds in ${label}: "${part}" (Allowed: ${min}-${max})`);
        }
      }
    };

    validateField(fields[0], 0, 59, "minute");
    validateField(fields[1], 0, 23, "hour");
    validateField(fields[2], 1, 31, "day-of-month");
    validateField(fields[3], 1, 12, "month");
    validateField(fields[4], 0, 6, "day-of-week");
  }

  /**
   * 5. Validate Interval.
   */
  public static validateInterval(intervalMs: number): void {
    if (typeof intervalMs !== "number" || intervalMs <= 0 || !Number.isInteger(intervalMs)) {
      throw new TaskSchedulerValidationException(`Interval milliseconds "${intervalMs}" must be a positive integer.`);
    }
  }

  /**
   * 6. Validate Circular Task Dependencies.
   */
  public static validateCircularDependencies(tasks: ScheduledTask[]): void {
    const adj = new Map<string, string[]>();
    for (const t of tasks) {
      adj.set(t.id, t.dependencies);
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (id: string): boolean => {
      visited.add(id);
      recStack.add(id);
      for (const dep of adj.get(id) || []) {
        if (!visited.has(dep)) {
          if (dfs(dep)) return true;
        } else if (recStack.has(dep)) {
          return true;
        }
      }
      recStack.delete(id);
      return false;
    };

    for (const t of tasks) {
      if (!visited.has(t.id)) {
        if (dfs(t.id)) {
          throw new TaskSchedulerValidationException("Circular task dependency detected in schedule.");
        }
      }
    }
  }

  /**
   * 7. Validate Retry Policy.
   */
  public static validateRetryPolicy(policy: RetryPolicyConfig): void {
    if (!policy) {
      throw new TaskSchedulerValidationException("Retry policy is missing.");
    }
    if (!Object.values(RetryPolicy).includes(policy.strategy)) {
      throw new TaskSchedulerValidationException(`Invalid retry strategy "${policy.strategy}".`);
    }
    if (typeof policy.maxRetries !== "number" || policy.maxRetries < 0) {
      throw new TaskSchedulerValidationException("maxRetries must be a non-negative number.");
    }
    if (typeof policy.initialDelayMs !== "number" || policy.initialDelayMs < 0) {
      throw new TaskSchedulerValidationException("initialDelayMs must be a non-negative number.");
    }
  }

  /**
   * 8. Validate Queue Consistency.
   */
  public static validateQueueIntegrity(queue: QueueItem[], maxSize?: number): void {
    if (!Array.isArray(queue)) {
      throw new TaskSchedulerValidationException("Queue must be an array.");
    }
    if (maxSize !== undefined && queue.length > maxSize) {
      throw new TaskSchedulerValidationException(`Queue size limit exceeded. Max: ${maxSize}, Current: ${queue.length}.`);
    }
    for (const item of queue) {
      this.validateTaskId(item.taskId);
      if (!Object.values(TaskPriority).includes(item.priority)) {
        throw new TaskSchedulerValidationException(`Invalid queue priority "${item.priority}" on queue item.`);
      }
    }
  }

  /**
   * 9. Validate Execution Window time syntax.
   */
  public static validateTimeWindow(window: TimeWindow): void {
    if (!window) return;
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(window.startTime)) {
      throw new TaskSchedulerValidationException(`Invalid startTime format "${window.startTime}". Must be HH:MM.`);
    }
    if (!timeRegex.test(window.endTime)) {
      throw new TaskSchedulerValidationException(`Invalid endTime format "${window.endTime}". Must be HH:MM.`);
    }
  }

  /**
   * 10. Validate State Transitions.
   */
  public static validateStateTransition(current: SchedulerState, target: SchedulerState): void {
    const allowed: Record<SchedulerState, SchedulerState[]> = {
      [SchedulerState.CREATED]: [SchedulerState.INITIALIZING, SchedulerState.FAILED],
      [SchedulerState.INITIALIZING]: [SchedulerState.RUNNING, SchedulerState.FAILED],
      [SchedulerState.RUNNING]: [SchedulerState.PAUSED, SchedulerState.STOPPING, SchedulerState.FAILED],
      [SchedulerState.PAUSED]: [SchedulerState.RUNNING, SchedulerState.STOPPING, SchedulerState.FAILED],
      [SchedulerState.STOPPING]: [SchedulerState.STOPPED, SchedulerState.FAILED],
      [SchedulerState.STOPPED]: [SchedulerState.RUNNING, SchedulerState.FAILED],
      [SchedulerState.FAILED]: [SchedulerState.INITIALIZING, SchedulerState.RUNNING, SchedulerState.FAILED]
    };
    if (!allowed[current].includes(target)) {
      throw new InvalidTaskSchedulerStateException(`transition from ${current} to ${target}`, current);
    }
  }

  /**
   * 11. Validate Snapshot Immutability.
   */
  public static validateSnapshotImmutability(snapshot: SchedulerSnapshot): void {
    if (!snapshot) {
      throw new TaskSchedulerValidationException("Snapshot is missing.");
    }
    if (!Object.isFrozen(snapshot)) {
      throw new TaskSchedulerValidationException("SchedulerSnapshot is not frozen.");
    }
    if (!Object.isFrozen(snapshot.tasks) || snapshot.tasks.some(t => !Object.isFrozen(t))) {
      throw new TaskSchedulerValidationException("SchedulerSnapshot tasks array or task objects are not frozen.");
    }
    if (!Object.isFrozen(snapshot.queue) || snapshot.queue.some(q => !Object.isFrozen(q))) {
      throw new TaskSchedulerValidationException("SchedulerSnapshot queue array or queue items are not frozen.");
    }
    if (!Object.isFrozen(snapshot.metrics)) {
      throw new TaskSchedulerValidationException("SchedulerSnapshot metrics object is not frozen.");
    }
  }

  /**
   * 12. Validate TaskState Transition.
   */
  public static validateTaskStateTransition(current: TaskState, target: TaskState): void {
    const allowed: Record<TaskState, TaskState[]> = {
      [TaskState.PENDING]: [TaskState.QUEUED, TaskState.CANCELLED],
      [TaskState.QUEUED]: [TaskState.WAITING, TaskState.RUNNING, TaskState.CANCELLED],
      [TaskState.WAITING]: [TaskState.RUNNING, TaskState.SKIPPED, TaskState.CANCELLED],
      [TaskState.RUNNING]: [TaskState.COMPLETED, TaskState.FAILED, TaskState.CANCELLED],
      [TaskState.COMPLETED]: [TaskState.PENDING],
      [TaskState.FAILED]: [TaskState.PENDING, TaskState.FAILED],
      [TaskState.CANCELLED]: [TaskState.PENDING],
      [TaskState.SKIPPED]: [TaskState.PENDING]
    };
    if (!allowed[current].includes(target)) {
      throw new TaskSchedulerValidationException(`Invalid task state transition from ${current} to ${target}`);
    }
  }

  /**
   * 13. Validate TaskPriority values.
   */
  public static validatePriority(priority: TaskPriority): void {
    if (!Object.values(TaskPriority).includes(priority)) {
      throw new TaskSchedulerValidationException(`Invalid task priority "${priority}".`);
    }
  }

  /**
   * 14. Validate Schedule Rule.
   */
  public static validateScheduleRule(rule: ScheduleRule): void {
    if (!rule) {
      throw new TaskSchedulerValidationException("Schedule rule is missing.");
    }
    if (!Object.values(ScheduleType).includes(rule.type)) {
      throw new TaskSchedulerValidationException(`Invalid schedule type "${rule.type}".`);
    }
    if (!Object.values(TriggerType).includes(rule.triggerType)) {
      throw new TaskSchedulerValidationException(`Invalid trigger type "${rule.triggerType}".`);
    }

    if (rule.type === ScheduleType.CRON && rule.cronExpression) {
      this.validateCronExpression(rule.cronExpression);
    }
    if (rule.type === ScheduleType.INTERVAL && rule.intervalMs !== undefined) {
      this.validateInterval(rule.intervalMs);
    }
    if (rule.timeWindow) {
      this.validateTimeWindow(rule.timeWindow);
    }
  }

  /**
   * 15. Validate Scheduled Task.
   */
  public static validateScheduledTask(task: ScheduledTask): void {
    if (!task) {
      throw new TaskSchedulerValidationException("Scheduled task is missing.");
    }
    this.validateTaskId(task.id);
    if (!task.name || typeof task.name !== "string") {
      throw new TaskSchedulerValidationException("Task name must be a non-empty string.");
    }
    this.validatePriority(task.priority);
    this.validateScheduleRule(task.schedule);
    this.validateRetryPolicy(task.retryPolicy);
    if (!task.parameters || typeof task.parameters !== "object") {
      throw new TaskSchedulerValidationException("Task parameters must be an object.");
    }
  }
}
