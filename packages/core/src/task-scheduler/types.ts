import { SchedulerState } from "./SchedulerState";

export class TaskSchedulerException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class TaskNotFoundException extends TaskSchedulerException {
  constructor(taskId: string) {
    super(`Scheduled task with ID "${taskId}" was not found.`);
  }
}

export class TriggerException extends TaskSchedulerException {
  constructor(message: string) {
    super(message);
  }
}

export class CronParseException extends TaskSchedulerException {
  constructor(expression: string, reason: string) {
    super(`Failed to parse cron expression "${expression}": ${reason}`);
  }
}

export class TaskSchedulerValidationException extends TaskSchedulerException {
  constructor(message: string) {
    super(message);
  }
}

export class InvalidTaskSchedulerStateException extends TaskSchedulerException {
  constructor(action: string, currentState: SchedulerState) {
    super(`Cannot perform action "${action}" when scheduler state is "${currentState}".`);
  }
}

/**
 * Deep freezes an object recursively to ensure immutability.
 */
function isPlainObjectOrArray(value: unknown): boolean {
  if (Array.isArray(value)) return true;
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
export function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  Object.freeze(obj);

  Object.getOwnPropertyNames(obj).forEach((prop) => {
    const value = (obj as any)[prop];
    if (isPlainObjectOrArray(value) && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  });
  return obj;
}
