export class ProductionException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ProductionValidationException extends ProductionException {
  constructor(message: string) {
    super(message);
  }
}

export class DuplicateProductionException extends ProductionException {
  constructor(productionId: string) {
    super(`Production with ID "${productionId}" is already registered.`);
  }
}

export class InvalidProductionStateException extends ProductionException {
  constructor(productionId: string, action: string, currentState: string) {
    super(
      `Cannot perform "${action}" on production "${productionId}" because it is currently in state "${currentState}".`
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
