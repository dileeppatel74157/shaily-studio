import { SchedulerState } from "./SchedulerState";
import { TaskState } from "./TaskState";
import { ScheduleType } from "./ScheduleType";
import { TriggerType } from "./TriggerType";
import { RetryStrategy } from "./RetryStrategy";
import { QueuePriority } from "./QueuePriority";
import { DependencyState } from "./DependencyState";
import { SchedulerEventType } from "./SchedulerEventType";
import {
  SchedulerValidationException,
  InvalidSchedulerStateException,
  CronParseException
} from "./types";
import {
  ScheduledTask,
  ScheduleRule,
  CronSchedule,
  RetryPolicy,
  QueueItem,
  TaskDependency,
  SchedulerSnapshot,
  TimeWindow
} from "./models";

export class SchedulerValidator {
  /**
   * 1. Validate Identifier format.
   */
  public static validateIdentifier(id: string, label: string): void {
    if (!id || typeof id !== "string") {
      throw new SchedulerValidationException(`${label} must be a non-empty string.`);
    }
    const regex = /^[a-zA-Z0-9_\-]+$/;
    if (!regex.test(id)) {
      throw new SchedulerValidationException(`${label} "${id}" contains illegal characters or spaces.`);
    }
  }

  /**
   * 2. Validate Task ID.
   */
  public static validateTaskId(id: string): void {
    this.validateIdentifier(id, "Task ID");
  }

  /**
   * 3. Validate Cron Expression.
   */
  public static validateCronExpression(expression: string): void {
    if (!expression || typeof expression !== "string") {
      throw new CronParseException(expression, "Cron expression must be a non-empty string.");
    }
    const fields = expression.trim().split(/\s+/);
    if (fields.length !== 5) {
      throw new CronParseException(expression, "Must contain exactly 5 space-separated fields (minute hour day month day-of-week).");
    }

    const validateField = (field: string, min: number, max: number, label: string) => {
      if (field === "*") return;
      const parts = field.split(",");
      for (const part of parts) {
        // step check (e.g. */5)
        if (part.startsWith("*/")) {
          const step = parseInt(part.substring(2));
          if (isNaN(step) || step <= 0) {
            throw new CronParseException(expression, `Invalid step value in ${label}: "${part}"`);
          }
          continue;
        }
        // range check (e.g. 1-5)
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
        // normal number check
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
   * 4. Validate Interval.
   */
  public static validateInterval(intervalMs: number): void {
    if (typeof intervalMs !== "number" || intervalMs <= 0 || !Number.isInteger(intervalMs)) {
      throw new SchedulerValidationException(`Interval milliseconds "${intervalMs}" must be a positive integer.`);
    }
  }

  /**
   * 5. Validate Circular Task Dependencies.
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
          throw new SchedulerValidationException("Circular task dependency detected in schedule.");
        }
      }
    }
  }

  /**
   * 6. Validate Retry Policy.
   */
  public static validateRetryPolicy(policy: RetryPolicy): void {
    if (!policy) {
      throw new SchedulerValidationException("Retry policy is missing.");
    }
    if (!Object.values(RetryStrategy).includes(policy.strategy)) {
      throw new SchedulerValidationException(`Invalid retry strategy "${policy.strategy}".`);
    }
    if (typeof policy.maxRetries !== "number" || policy.maxRetries < 0) {
      throw new SchedulerValidationException("maxRetries must be a non-negative number.");
    }
    if (typeof policy.initialDelayMs !== "number" || policy.initialDelayMs < 0) {
      throw new SchedulerValidationException("initialDelayMs must be a non-negative number.");
    }
  }

  /**
   * 7. Validate Queue Integrity.
   */
  public static validateQueueIntegrity(queue: QueueItem[], maxSize?: number): void {
    if (!Array.isArray(queue)) {
      throw new SchedulerValidationException("Queue must be an array.");
    }
    if (maxSize !== undefined && queue.length > maxSize) {
      throw new SchedulerValidationException(`Queue size limit exceeded. Max: ${maxSize}, Current: ${queue.length}.`);
    }
    for (const item of queue) {
      this.validateTaskId(item.taskId);
      if (!Object.values(QueuePriority).includes(item.priority)) {
        throw new SchedulerValidationException(`Invalid queue priority "${item.priority}" on queue item.`);
      }
    }
  }

  /**
   * 8. Validate Time Window / Time syntax.
   */
  public static validateTimeWindow(window: TimeWindow): void {
    if (!window) return;
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(window.startTime)) {
      throw new SchedulerValidationException(`Invalid startTime format "${window.startTime}". Must be HH:MM.`);
    }
    if (!timeRegex.test(window.endTime)) {
      throw new SchedulerValidationException(`Invalid endTime format "${window.endTime}". Must be HH:MM.`);
    }
  }

  /**
   * 9. Validate Scheduler State Transition.
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
      throw new InvalidSchedulerStateException(`transition from ${current} to ${target}`, current);
    }
  }

  /**
   * 10. Validate Snapshot Immutability.
   */
  public static validateSnapshotImmutability(snapshot: SchedulerSnapshot): void {
    if (!snapshot) {
      throw new SchedulerValidationException("Snapshot is missing.");
    }
    if (!Object.isFrozen(snapshot)) {
      throw new SchedulerValidationException("SchedulerSnapshot is not frozen.");
    }
    if (!Object.isFrozen(snapshot.tasks) || snapshot.tasks.some(t => !Object.isFrozen(t))) {
      throw new SchedulerValidationException("SchedulerSnapshot tasks array or task objects are not frozen.");
    }
    if (!Object.isFrozen(snapshot.queue) || snapshot.queue.some(q => !Object.isFrozen(q))) {
      throw new SchedulerValidationException("SchedulerSnapshot queue array or queue items are not frozen.");
    }
    if (!Object.isFrozen(snapshot.metrics)) {
      throw new SchedulerValidationException("SchedulerSnapshot metrics object is not frozen.");
    }
  }

  /**
   * 11. Validate TaskState Transition.
   */
  public static validateTaskStateTransition(current: TaskState, target: TaskState): void {
    const allowed: Record<TaskState, TaskState[]> = {
      [TaskState.PENDING]: [TaskState.QUEUED, TaskState.CANCELLED],
      [TaskState.QUEUED]: [TaskState.WAITING, TaskState.RUNNING, TaskState.CANCELLED],
      [TaskState.WAITING]: [TaskState.RUNNING, TaskState.SKIPPED, TaskState.CANCELLED],
      [TaskState.RUNNING]: [TaskState.COMPLETED, TaskState.FAILED, TaskState.CANCELLED],
      [TaskState.COMPLETED]: [TaskState.PENDING], // Allowed for recurring tasks
      [TaskState.FAILED]: [TaskState.PENDING, TaskState.FAILED], // Allowed for retries
      [TaskState.CANCELLED]: [TaskState.PENDING],
      [TaskState.SKIPPED]: [TaskState.PENDING]
    };
    if (!allowed[current].includes(target)) {
      throw new SchedulerValidationException(`Invalid task state transition from ${current} to ${target}`);
    }
  }

  /**
   * 12. Validate Priority values.
   */
  public static validatePriority(priority: QueuePriority): void {
    if (!Object.values(QueuePriority).includes(priority)) {
      throw new SchedulerValidationException(`Invalid queue priority "${priority}".`);
    }
  }

  /**
   * 13. Validate Schedule Rule.
   */
  public static validateScheduleRule(rule: ScheduleRule): void {
    if (!rule) {
      throw new SchedulerValidationException("Schedule rule is missing.");
    }
    if (!Object.values(ScheduleType).includes(rule.type)) {
      throw new SchedulerValidationException(`Invalid schedule type "${rule.type}".`);
    }
    if (!Object.values(TriggerType).includes(rule.triggerType)) {
      throw new SchedulerValidationException(`Invalid trigger type "${rule.triggerType}".`);
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
   * 14. Validate Scheduled Task.
   */
  public static validateScheduledTask(task: ScheduledTask): void {
    if (!task) {
      throw new SchedulerValidationException("Scheduled task is missing.");
    }
    this.validateTaskId(task.id);
    if (!task.name || typeof task.name !== "string") {
      throw new SchedulerValidationException("Task name must be a non-empty string.");
    }
    this.validatePriority(task.priority);
    this.validateScheduleRule(task.schedule);
    this.validateRetryPolicy(task.retryPolicy);
    if (!task.parameters || typeof task.parameters !== "object") {
      throw new SchedulerValidationException("Task parameters must be an object.");
    }
  }
}
