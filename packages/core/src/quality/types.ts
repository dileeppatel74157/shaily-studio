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
