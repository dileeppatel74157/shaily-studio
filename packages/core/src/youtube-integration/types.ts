export class YouTubeException extends Error {
  constructor(message: string, public readonly code: string = "YOUTUBE_ERROR") {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AuthenticationException extends YouTubeException {
  constructor(message: string) {
    super(message, "AUTHENTICATION_FAILED");
  }
}

export class UploadException extends YouTubeException {
  constructor(message: string) {
    super(message, "UPLOAD_FAILED");
  }
}

export class MetadataException extends YouTubeException {
  constructor(message: string) {
    super(message, "METADATA_BUILD_FAILED");
  }
}

export class ScheduleException extends YouTubeException {
  constructor(message: string) {
    super(message, "SCHEDULE_FAILED");
  }
}

export class ProcessingException extends YouTubeException {
  constructor(message: string) {
    super(message, "PROCESSING_MONITOR_FAILED");
  }
}

export class ValidationException extends YouTubeException {
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
