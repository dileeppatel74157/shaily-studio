// ─── Publishing Exception Hierarchy ──────────────────────────────────────────

export class PublishingException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class PublishingValidationException extends PublishingException {
  constructor(message: string) {
    super(message);
  }
}

export class DuplicatePublishingException extends PublishingException {
  constructor(jobId: string) {
    super(`Publishing job with ID "${jobId}" is already registered.`);
  }
}

export class InvalidPublishingStateException extends PublishingException {
  constructor(jobId: string, action: string, currentState: string) {
    super(
      `Cannot perform "${action}" on publishing job "${jobId}" ` +
      `because it is currently in state "${currentState}".`
    );
  }
}

export class PublishingPlatformException extends PublishingException {
  constructor(platform: string, reason: string) {
    super(`Platform "${platform}" encountered an error: ${reason}`);
  }
}

export class PublishingRetryExhaustedException extends PublishingException {
  constructor(jobId: string, maxRetries: number) {
    super(
      `Publishing job "${jobId}" has exhausted all ${maxRetries} retry attempts and cannot be retried further.`
    );
  }
}

// ─── Deep Freeze Utility ──────────────────────────────────────────────────────

/**
 * Recursively deep-freezes an object to enforce immutability.
 * Skips the `context` property to avoid circular reference issues.
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
