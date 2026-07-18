// ─── Analytics Exception Hierarchy ───────────────────────────────────────────

export class AnalyticsException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AnalyticsValidationException extends AnalyticsException {
  constructor(message: string) {
    super(message);
  }
}

export class DuplicateAnalyticsException extends AnalyticsException {
  constructor(id: string) {
    super(`Analytics entry with ID "${id}" is already registered.`);
  }
}

export class InvalidAnalyticsStateException extends AnalyticsException {
  constructor(id: string, action: string, currentState: string) {
    super(
      `Cannot perform "${action}" on analytics job "${id}" ` +
      `because it is currently in state "${currentState}".`
    );
  }
}

export class AnalyticsPlatformException extends AnalyticsException {
  constructor(platform: string, reason: string) {
    super(`Analytics provider "${platform}" error: ${reason}`);
  }
}

export class AnalyticsProviderNotFoundException extends AnalyticsException {
  constructor(platform: string) {
    super(`No analytics provider registered for platform "${platform}".`);
  }
}

// ─── Deep Freeze Utility ──────────────────────────────────────────────────────

/**
 * Recursively deep-freezes an object to enforce snapshot immutability.
 * Skips the `context` property to avoid circular references.
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
