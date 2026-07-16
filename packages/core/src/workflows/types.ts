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
