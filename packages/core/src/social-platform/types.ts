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
export function deepFreeze<T extends object>(obj: T): Readonly<T> {
  const propNames = Reflect.ownKeys(obj);

  for (const name of propNames) {
    const value = (obj as any)[name];

    if (value && typeof value === "object") {
      deepFreeze(value);
    }
  }

  return Object.freeze(obj);
}
