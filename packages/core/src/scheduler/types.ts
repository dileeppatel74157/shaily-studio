import { SchedulerState } from "./SchedulerState";

export class SchedulerException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class SchedulerValidationException extends SchedulerException {
  constructor(message: string) {
    super(message);
  }
}

export class InvalidSchedulerStateException extends SchedulerException {
  constructor(action: string, currentState: SchedulerState) {
    super(`Cannot perform "${action}" while Scheduler is in "${currentState}" state.`);
  }
}

export class JobExecutionException extends SchedulerException {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Recursively deep-freezes a given object, enforcing immutability.
 * Uses type constraints and avoids 'any' to conform to strict TypeScript.
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
