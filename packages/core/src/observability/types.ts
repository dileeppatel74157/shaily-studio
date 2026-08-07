import { ObservabilityState } from "./ObservabilityState";

export class ObservabilityException extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = "ObservabilityException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ObservabilityValidationException extends ObservabilityException {
  constructor(message: string) {
    super(message);
    this.name = "ObservabilityValidationException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidObservabilityStateException extends ObservabilityException {
  constructor(action: string, currentState: ObservabilityState) {
    super(`Cannot perform action "${action}" when ObservabilityEngine is in state "${currentState}".`);
    this.name = "InvalidObservabilityStateException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

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
