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
