export class StrategyException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class StrategyValidationException extends StrategyException {
  constructor(message: string) {
    super(message);
  }
}

export class DuplicateStrategyException extends StrategyException {
  constructor(strategyId: string) {
    super(`Strategy with ID "${strategyId}" is already registered.`);
  }
}

export class InvalidStrategyStateException extends StrategyException {
  constructor(strategyId: string, action: string, currentState: string) {
    super(
      `Cannot perform "${action}" on strategy "${strategyId}" because it is currently in state "${currentState}".`
    );
  }
}

function isPlainObjectOrArray(value: unknown): boolean {
  if (Array.isArray(value)) return true;
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
export function deepFreeze<T>(obj: any): T {
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
