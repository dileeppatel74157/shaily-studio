export class VideoCompositionException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class VideoCompositionValidationException extends VideoCompositionException {
  constructor(message: string) {
    super(message);
  }
}

export class DuplicateCompositionException extends VideoCompositionException {
  constructor(compositionId: string) {
    super(`Composition with ID "${compositionId}" is already registered.`);
  }
}

export class InvalidCompositionLifecycleException extends VideoCompositionException {
  constructor(compositionId: string, action: string, currentState: string) {
    super(
      `Cannot perform "${action}" on composition "${compositionId}" because it is currently in state "${currentState}".`
    );
  }
}

export class MissingAssetException extends VideoCompositionException {
  constructor(assetId: string) {
    super(`Required asset "${assetId}" is missing from the generation response.`);
  }
}

/**
 * Recursively deep-freezes a given object to enforce immutability.
 * Skips the `context` field to avoid circular reference issues.
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
