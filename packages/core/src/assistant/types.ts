import { AssistantState } from "./AssistantState";

export class AssistantException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class IntentParserException extends AssistantException {
  constructor(message: string) {
    super(message);
  }
}

export class PlannerException extends AssistantException {
  constructor(message: string) {
    super(message);
  }
}

export class SessionNotFoundException extends AssistantException {
  constructor(sessionId: string) {
    super(`Assistant session with ID "${sessionId}" was not found.`);
  }
}

export class AssistantValidationException extends AssistantException {
  constructor(message: string) {
    super(message);
  }
}

export class InvalidAssistantStateException extends AssistantException {
  constructor(action: string, currentState: AssistantState) {
    super(`Cannot perform action "${action}" when assistant state is "${currentState}".`);
  }
}

/**
 * Deep freezes an object recursively to ensure immutability.
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
