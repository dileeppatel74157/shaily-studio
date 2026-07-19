import { SchedulerState } from "./SchedulerState";

export class SchedulerException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class TaskNotFoundException extends SchedulerException {
  constructor(taskId: string) {
    super(`Scheduled task with ID "${taskId}" was not found.`);
  }
}

export class TriggerException extends SchedulerException {
  constructor(message: string) {
    super(message);
  }
}

export class CronParseException extends SchedulerException {
  constructor(expression: string, reason: string) {
    super(`Failed to parse cron expression "${expression}": ${reason}`);
  }
}

export class SchedulerValidationException extends SchedulerException {
  constructor(message: string) {
    super(message);
  }
}

export class InvalidSchedulerStateException extends SchedulerException {
  constructor(action: string, currentState: SchedulerState) {
    super(`Cannot perform action "${action}" when scheduler state is "${currentState}".`);
  }
}

/**
 * Deep freezes an object recursively to ensure immutability.
 */
export function deepFreeze<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj !== "object" && typeof obj !== "function") {
    return obj;
  }

  // Freeze self
  Object.freeze(obj);

  // Freeze properties
  const propNames = Object.getOwnPropertyNames(obj);
  for (const name of propNames) {
    const value = (obj as any)[name];
    if (
      value !== null &&
      value !== undefined &&
      (typeof value === "object" || typeof value === "function") &&
      !Object.isFrozen(value)
    ) {
      deepFreeze(value);
    }
  }

  return obj;
}
