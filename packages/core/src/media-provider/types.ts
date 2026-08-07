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
function isPlainObjectOrArray(value: unknown): boolean {
  if (Array.isArray(value)) return true;
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
export function deepFreeze<T>(obj: T): T {
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
