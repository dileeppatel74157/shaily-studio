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
