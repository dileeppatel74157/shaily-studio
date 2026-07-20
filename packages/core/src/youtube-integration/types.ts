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
