import { MediaProviderState } from "./MediaProviderState";

export class MediaProviderException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class GenerationException extends MediaProviderException {
  constructor(message: string) {
    super(message);
  }
}

export class UnsupportedMediaException extends MediaProviderException {
  constructor(message: string) {
    super(message);
  }
}

export class ProviderUnavailableException extends MediaProviderException {
  constructor(providerId: string) {
    super(`Media Provider "${providerId}" is currently unavailable or offline.`);
  }
}

export class InvalidMediaRequestException extends MediaProviderException {
  constructor(message: string) {
    super(message);
  }
}

export class StreamingException extends MediaProviderException {
  constructor(message: string) {
    super(message);
  }
}

export class InvalidMediaStateException extends MediaProviderException {
  constructor(action: string, currentState: MediaProviderState) {
    super(`Cannot perform action "${action}" when MediaProvider is in state "${currentState}".`);
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

  Object.freeze(obj);

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
