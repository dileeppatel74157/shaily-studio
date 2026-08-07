export class SocialPlatformException extends Error {
  constructor(message: string, public readonly code: string = "SOCIAL_PLATFORM_ERROR") {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class PlatformConnectionException extends SocialPlatformException {
  constructor(message: string) {
    super(message, "PLATFORM_CONNECTION_FAILED");
  }
}

export class PublishingException extends SocialPlatformException {
  constructor(message: string) {
    super(message, "PUBLISHING_FAILED");
  }
}

export class MediaValidationException extends SocialPlatformException {
  constructor(message: string) {
    super(message, "MEDIA_VALIDATION_FAILED");
  }
}

export class SchedulingException extends SocialPlatformException {
  constructor(message: string) {
    super(message, "SCHEDULING_FAILED");
  }
}

export class AnalyticsException extends SocialPlatformException {
  constructor(message: string) {
    super(message, "ANALYTICS_FAILED");
  }
}

export class ValidationException extends SocialPlatformException {
  constructor(message: string) {
    super(message, "VALIDATION_FAILED");
  }
}

/**
 * Deep freezes an object.
 */
function isPlainObjectOrArray(value: unknown): boolean {
  if (Array.isArray(value)) return true;
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
export function deepFreeze<T extends object>(obj: T): Readonly<T> {
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
