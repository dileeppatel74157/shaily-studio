export class SupervisorException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class SupervisorValidationException extends SupervisorException {
  constructor(message: string) {
    super(message);
  }
}

export class LimitExceededException extends SupervisorException {
  constructor(limitName: string, value: number, limit: number) {
    super(`Execution limit exceeded for "${limitName}": value is ${value}, limit is ${limit}`);
  }
}

export class BudgetExceededException extends SupervisorException {
  constructor(budgetName: string, value: number, budget: number) {
    super(`Execution budget exceeded for "${budgetName}": value is ${value}, budget is ${budget}`);
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
