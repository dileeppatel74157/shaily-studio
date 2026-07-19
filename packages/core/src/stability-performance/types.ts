import { StabilityState } from "./StabilityState";

export class StabilityException extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = "StabilityException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class StabilityValidationException extends StabilityException {
  constructor(message: string) {
    super(message);
    this.name = "StabilityValidationException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidStabilityStateException extends StabilityException {
  constructor(action: string, currentState: StabilityState) {
    super(`Cannot perform action "${action}" when StabilityPerformanceEngine is in state "${currentState}".`);
    this.name = "InvalidStabilityStateException";
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
