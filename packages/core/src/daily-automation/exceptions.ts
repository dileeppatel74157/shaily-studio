export class DailyAutomationException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class RoutineException extends DailyAutomationException {
  constructor(message: string) {
    super(message);
  }
}

export class ScheduleException extends DailyAutomationException {
  constructor(message: string) {
    super(message);
  }
}

export class ExecutionException extends DailyAutomationException {
  constructor(message: string) {
    super(message);
  }
}

export class AutomationValidationException extends DailyAutomationException {
  constructor(message: string) {
    super(message);
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
