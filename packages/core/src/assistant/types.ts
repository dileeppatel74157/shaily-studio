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
export function deepFreeze<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj !== "object" && typeof obj !== "function") {
    return obj;
  }

  // Freeze self
  Object.freeze(obj);

  // Freeze properties
  const propNames = Object.getOwnPropertyNames(obj);
  for (const name of propNames) {
    const value = (obj as any)[name];
    if (
      value !== null &&
      value !== undefined &&
      (typeof value === "object" || typeof value === "function") &&
      !Object.isFrozen(value)
    ) {
      deepFreeze(value);
    }
  }

  return obj;
}
