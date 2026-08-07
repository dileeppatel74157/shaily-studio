import { WorkflowState } from "./WorkflowState";

export class WorkflowException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidWorkflowStateException extends WorkflowException {
  constructor(action: string, currentState: WorkflowState) {
    super(`Cannot perform "${action}" while WorkflowEngine is in "${currentState}" state.`);
  }
}

export class WorkflowValidationException extends WorkflowException {
  constructor(message: string) {
    super(message);
  }
}

export class WorkflowExecutionException extends WorkflowException {
  constructor(message: string, public readonly executionId?: string) {
    super(message);
  }
}

/**
 * Recursively deep-freezes a given object to enforce strict immutability.
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
