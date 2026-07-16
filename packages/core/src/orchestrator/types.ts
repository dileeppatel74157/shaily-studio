export class OrchestratorException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidOrchestratorStateException extends OrchestratorException {
  constructor(action: string, currentState: string) {
    super(`Cannot perform "${action}" because AI Orchestrator is in state "${currentState}".`);
  }
}

export class OrchestratorValidationException extends OrchestratorException {
  constructor(message: string) {
    super(message);
  }
}

export function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    const val = (obj as any)[prop];
    if (
      Object.prototype.hasOwnProperty.call(obj, prop) &&
      val !== null &&
      (typeof val === "object" || typeof val === "function") &&
      !Object.isFrozen(val)
    ) {
      deepFreeze(val);
    }
  });
  return obj;
}
