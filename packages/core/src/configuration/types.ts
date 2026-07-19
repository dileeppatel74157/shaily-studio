import { ConfigurationState } from "./ConfigurationState";

export class ConfigurationException extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = "ConfigurationException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ConfigurationValidationException extends ConfigurationException {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationValidationException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidConfigurationStateException extends ConfigurationException {
  constructor(action: string, currentState: ConfigurationState) {
    super(`Cannot perform action "${action}" when ConfigurationEngine is in state "${currentState}".`);
    this.name = "InvalidConfigurationStateException";
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
