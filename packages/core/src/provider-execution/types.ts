import { ExecutionState } from "./ExecutionState";

export class ExecutionException extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = "ExecutionException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ExecutionValidationException extends ExecutionException {
  constructor(message: string) {
    super(message);
    this.name = "ExecutionValidationException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidExecutionStateException extends ExecutionException {
  constructor(action: string, currentState: ExecutionState) {
    super(`Cannot perform action "${action}" when ProviderExecutionEngine is in state "${currentState}".`);
    this.name = "InvalidExecutionStateException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BudgetExceededException extends ExecutionException {
  constructor(requestId: string, estimatedCostUsd: number, limitUsd: number) {
    super(
      `Request "${requestId}" estimated cost $${estimatedCostUsd.toFixed(4)} exceeds budget limit $${limitUsd.toFixed(4)}.`
    );
    this.name = "BudgetExceededException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class EmergencyStopException extends ExecutionException {
  constructor(reason: string) {
    super(`Emergency stop is active. All AI requests are blocked. Reason: ${reason}`);
    this.name = "EmergencyStopException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

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
