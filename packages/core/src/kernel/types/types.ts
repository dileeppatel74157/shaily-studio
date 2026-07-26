import { KernelState } from "./KernelState";

export class KernelException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class KernelValidationException extends KernelException {
  constructor(message: string) {
    super(message);
  }
}

export class InvalidKernelStateException extends KernelException {
  constructor(action: string, currentState: KernelState) {
    super(`Cannot perform "${action}" while Kernel is in "${currentState}" state.`);
  }
}

export class CircularDependencyException extends KernelValidationException {
  constructor(cycle: string[]) {
    super(`Circular dependency detected: ${cycle.join(" -> ")}`);
  }
}

export class MissingDependencyException extends KernelValidationException {
  constructor(moduleId: string, dependencyId: string) {
    super(`Module "${moduleId}" depends on missing module "${dependencyId}"`);
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
