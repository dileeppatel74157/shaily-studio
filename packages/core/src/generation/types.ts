export class GenerationException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class GenerationValidationException extends GenerationException {
  constructor(message: string) {
    super(message);
  }
}

export class DuplicateGenerationException extends GenerationException {
  constructor(generationId: string) {
    super(`Generation with ID "${generationId}" is already registered.`);
  }
}

export class InvalidGenerationStateException extends GenerationException {
  constructor(generationId: string, action: string, currentState: string) {
    super(
      `Cannot perform "${action}" on generation "${generationId}" because it is currently in state "${currentState}".`
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
