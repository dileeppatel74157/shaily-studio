import { IntegrationState } from "./IntegrationState";

export class IntegrationException extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = "IntegrationException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class IntegrationValidationException extends IntegrationException {
  constructor(message: string) {
    super(message);
    this.name = "IntegrationValidationException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidIntegrationStateException extends IntegrationException {
  constructor(action: string, currentState: IntegrationState) {
    super(`Cannot perform action "${action}" when SystemIntegrationEngine is in state "${currentState}".`);
    this.name = "InvalidIntegrationStateException";
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
