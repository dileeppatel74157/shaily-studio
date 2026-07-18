export class QualityException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class QualityValidationException extends QualityException {
  constructor(message: string) {
    super(message);
  }
}

export class DuplicateQualityException extends QualityException {
  constructor(qualityId: string) {
    super(`Quality review with ID "${qualityId}" is already registered.`);
  }
}

export class InvalidQualityStateException extends QualityException {
  constructor(qualityId: string, action: string, currentState: string) {
    super(
      `Cannot perform "${action}" on quality review "${qualityId}" ` +
      `because it is currently in state "${currentState}".`
    );
  }
}

export class QualityRejectionException extends QualityException {
  constructor(qualityId: string, score: number, threshold: number) {
    super(
      `Quality review "${qualityId}" was REJECTED: overall score ${score}/100 ` +
      `is below approval threshold of ${threshold}/100.`
    );
  }
}

/**
 * Recursively deep-freezes an object to enforce immutability.
 * Skips the `context` property to avoid circular reference issues.
 */
export function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;
  Object.freeze(obj);
  const typed = obj as unknown as Record<string, unknown>;
  Object.getOwnPropertyNames(typed).forEach((prop) => {
    if (prop === "context") return;
    if (
      Object.prototype.hasOwnProperty.call(typed, prop) &&
      typed[prop] !== null &&
      (typeof typed[prop] === "object" || typeof typed[prop] === "function") &&
      !Object.isFrozen(typed[prop])
    ) {
      deepFreeze(typed[prop]);
    }
  });
  return obj;
}
