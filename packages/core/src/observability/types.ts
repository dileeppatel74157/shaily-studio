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

export function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  
  Object.freeze(obj);
  
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    const value = (obj as any)[prop];
    if (value !== null && (typeof value === "object" || typeof value === "function") && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  });
  
  return obj;
}
