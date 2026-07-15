import { ConfigurationState } from "./ConfigurationState";

export class ConfigurationException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ConfigurationValidationException extends ConfigurationException {
  constructor(message: string) {
    super(message);
  }
}

export class InvalidConfigurationStateException extends ConfigurationException {
  constructor(action: string, currentState: ConfigurationState) {
    super(`Cannot perform "${action}" while Configuration is in "${currentState}" state.`);
  }
}

export class ConfigurationChangeException extends ConfigurationException {
  constructor(message: string) {
    super(message);
  }
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
