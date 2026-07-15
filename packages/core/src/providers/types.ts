import { ProviderSnapshot } from "./ProviderSnapshot";

export class ProviderException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ProviderValidationException extends ProviderException {
  constructor(message: string) {
    super(message);
  }
}

export class InvalidProviderStateException extends ProviderException {
  constructor(action: string, currentState: string) {
    super(`Cannot perform "${action}" while Provider is in "${currentState}" state.`);
  }
}

export interface ProviderRegistrySnapshot {
  readonly timestamp: Date;
  readonly count: number;
  readonly providers: readonly ProviderSnapshot[];
}

/**
 * Recursively deep-freezes a given object, enforcing immutability.
 * Uses type constraints and avoids 'any' to conform to strict TypeScript.
 */
export function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  Object.freeze(obj);
  
  const typedObj = obj as unknown as Record<string, unknown>;
  Object.getOwnPropertyNames(typedObj).forEach((prop) => {
    if (
      Object.prototype.hasOwnProperty.call(typedObj, prop) &&
      typedObj[prop] !== null &&
      (typeof typedObj[prop] === "object" || typeof typedObj[prop] === "function") &&
      !Object.isFrozen(typedObj[prop])
    ) {
      deepFreeze(typedObj[prop]);
    }
  });
  return obj;
}
