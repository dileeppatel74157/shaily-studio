import { RuntimeState } from "../models/RuntimeState";

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
