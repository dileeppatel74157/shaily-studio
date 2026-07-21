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
