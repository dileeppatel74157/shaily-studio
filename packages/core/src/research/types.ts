export class ResearchException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ResearchValidationException extends ResearchException {
  constructor(message: string) {
    super(message);
  }
}

export class DuplicateResearchException extends ResearchException {
  constructor(requestId: string) {
    super(`Research request with ID "${requestId}" is already registered.`);
  }
}

export class InvalidResearchStateException extends ResearchException {
  constructor(requestId: string, action: string, currentState: string) {
    super(
      `Cannot perform "${action}" on research request "${requestId}" because it is currently in state "${currentState}".`
    );
  }
}

export function deepFreeze<T>(obj: any): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    if (prop === "context") return;
    if (
      obj.hasOwnProperty(prop) &&
      obj[prop] !== null &&
      (typeof obj[prop] === "object" || typeof obj[prop] === "function") &&
      !Object.isFrozen(obj[prop])
    ) {
      deepFreeze(obj[prop]);
    }
  });
  return obj;
}
