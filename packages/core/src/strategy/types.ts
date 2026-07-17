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

export function deepFreeze<T>(obj: any): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    if (prop === "context") return;
    if (
      obj.hasOwnProperty(prop) &&
      obj[prop] !== null &&
      (typeof obj[prop] === "object" || typeof obj[prop] === "function") &&
      !Object.isFrozen(obj[prop])
    ) {
      deepFreeze(obj[prop]);
    }
  });
  return obj;
}
