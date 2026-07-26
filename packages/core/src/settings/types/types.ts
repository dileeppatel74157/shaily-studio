import { SettingsState } from "./SettingsState";

export class SettingsException extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = "SettingsException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class SettingsValidationException extends SettingsException {
  constructor(message: string) {
    super(message);
    this.name = "SettingsValidationException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidSettingsStateException extends SettingsException {
  constructor(action: string, currentState: SettingsState) {
    super(`Cannot perform action "${action}" when SettingsEngine is in state "${currentState}".`);
    this.name = "InvalidSettingsStateException";
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
