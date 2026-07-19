import { RuntimeState } from "./RuntimeState";

export class RuntimeException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class EngineNotFoundException extends RuntimeException {
  constructor(engineId: string) {
    super(`Engine with ID "${engineId}" was not found.`);
  }
}

export class DependencyException extends RuntimeException {
  constructor(message: string) {
    super(message);
  }
}

export class HealthCheckException extends RuntimeException {
  constructor(message: string) {
    super(message);
  }
}

export class StartupException extends RuntimeException {
  constructor(message: string) {
    super(message);
  }
}

export class ShutdownException extends RuntimeException {
  constructor(message: string) {
    super(message);
  }
}

export class SchedulerException extends RuntimeException {
  constructor(message: string) {
    super(message);
  }
}

export class RuntimeValidationException extends RuntimeException {
  constructor(message: string) {
    super(message);
  }
}

export class InvalidRuntimeStateException extends RuntimeException {
  constructor(action: string, currentState: RuntimeState) {
    super(`Cannot perform action "${action}" in state "${currentState}".`);
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
