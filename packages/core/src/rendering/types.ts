export class RenderingException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class RenderingValidationException extends RenderingException {
  constructor(message: string) {
    super(message);
  }
}

export class DuplicateRenderException extends RenderingException {
  constructor(renderId: string) {
    super(`Render job with ID "${renderId}" is already registered.`);
  }
}

export class InvalidRenderingStateException extends RenderingException {
  constructor(renderId: string, action: string, currentState: string) {
    super(
      `Cannot perform "${action}" on render "${renderId}" because it is currently in state "${currentState}".`
    );
  }
}

export class MissingTimelineException extends RenderingException {
  constructor(compositionId: string) {
    super(
      `Timeline for composition "${compositionId}" could not be retrieved for rendering.`
    );
  }
}

export class RenderFrameException extends RenderingException {
  constructor(frameId: string, reason: string) {
    super(`Frame "${frameId}" failed to render: ${reason}`);
  }
}

/**
 * Recursively deep-freezes a given object, enforcing immutability.
 * Skips `context` to avoid circular reference issues.
 */
export function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;
  Object.freeze(obj);
  const typed = obj as unknown as Record<string, unknown>;
  Object.getOwnPropertyNames(typed).forEach((prop) => {
    if (prop === "context") return;
    if (
      Object.prototype.hasOwnProperty.call(typed, prop) &&
      typed[prop] !== null &&
      (typeof typed[prop] === "object" || typeof typed[prop] === "function") &&
      !Object.isFrozen(typed[prop])
    ) {
      deepFreeze(typed[prop]);
    }
  });
  return obj;
}
