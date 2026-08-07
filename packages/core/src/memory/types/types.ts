export class MemoryException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidMemoryException extends MemoryException {
  constructor(message: string) {
    super(message);
  }
}

export class MemoryValidationException extends MemoryException {
  constructor(message: string) {
    super(message);
  }
}

export class InvalidMemoryStateException extends MemoryException {
  constructor(action: string, currentState: string) {
    super(`Cannot perform "${action}" because memory engine is in state "${currentState}".`);
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
