import { ProviderState } from "./ProviderState";

export class LLMProviderException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ProviderNotFoundException extends LLMProviderException {
  constructor(providerId: string) {
    super(`LLM Provider "${providerId}" was not found or is not registered.`);
  }
}

export class ModelUnsupportedException extends LLMProviderException {
  constructor(modelId: string, providerId: string) {
    super(`Model "${modelId}" is not supported by provider "${providerId}".`);
  }
}

export class RequestTimeoutException extends LLMProviderException {
  constructor(message: string) {
    super(message);
  }
}

export class RateLimitException extends LLMProviderException {
  constructor(message: string) {
    super(message);
  }
}

export class StreamingException extends LLMProviderException {
  constructor(message: string) {
    super(message);
  }
}

export class EmbeddingException extends LLMProviderException {
  constructor(message: string) {
    super(message);
  }
}

export class LLMProviderValidationException extends LLMProviderException {
  constructor(message: string) {
    super(message);
  }
}

export class InvalidProviderStateException extends LLMProviderException {
  constructor(action: string, currentState: ProviderState) {
    super(`Cannot perform action "${action}" when LLMProvider is in state "${currentState}".`);
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
