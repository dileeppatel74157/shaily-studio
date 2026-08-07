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
