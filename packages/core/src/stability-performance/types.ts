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
