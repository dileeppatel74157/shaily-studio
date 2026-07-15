export class CompositionException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class CompositionValidationException extends CompositionException {
  constructor(message: string) {
    super(message);
  }
}

export class InvalidCompositionStateException extends CompositionException {
  constructor(action: string, currentState: string) {
    super(`Cannot perform "${action}" while Composition is in "${currentState}" state.`);
  }
}

export class CircularDependencyException extends CompositionException {
  constructor(path: string) {
    super(`Circular dependency detected: ${path}`);
  }
}

export class ServiceResolutionException extends CompositionException {
  constructor(token: string, message: string) {
    super(`Failed to resolve service for token "${token}": ${message}`);
  }
}

/**
 * Recursively deep-freezes a given object, enforcing immutability.
 * Uses type constraints and avoids 'any' to conform to strict TypeScript.
 */
export function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  Object.freeze(obj);
  
  const typedObj = obj as unknown as Record<string, unknown>;
  Object.getOwnPropertyNames(typedObj).forEach((prop) => {
    if (
      Object.prototype.hasOwnProperty.call(typedObj, prop) &&
      typedObj[prop] !== null &&
      (typeof typedObj[prop] === "object" || typeof typedObj[prop] === "function") &&
      !Object.isFrozen(typedObj[prop])
    ) {
      deepFreeze(typedObj[prop]);
    }
  });
  return obj;
}
