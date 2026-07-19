import { GatewayState } from "./GatewayState";

export class GatewayException extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = "GatewayException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class GatewayValidationException extends GatewayException {
  constructor(message: string) {
    super(message);
    this.name = "GatewayValidationException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidGatewayStateException extends GatewayException {
  constructor(action: string, currentState: GatewayState) {
    super(`Cannot perform action "${action}" when GatewayEngine is in state "${currentState}".`);
    this.name = "InvalidGatewayStateException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ProviderNotFoundException extends GatewayException {
  constructor(providerId: string) {
    super(`Provider "${providerId}" is not registered in the gateway.`);
    this.name = "ProviderNotFoundException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AuthenticationException extends GatewayException {
  constructor(providerId: string, reason: string) {
    super(`Authentication failed for provider "${providerId}": ${reason}`);
    this.name = "AuthenticationException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class CircuitOpenException extends GatewayException {
  constructor(providerId: string) {
    super(`Circuit breaker is OPEN for provider "${providerId}". Requests are blocked.`);
    this.name = "CircuitOpenException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    const value = (obj as any)[prop];
    if (
      value !== null &&
      (typeof value === "object" || typeof value === "function") &&
      !Object.isFrozen(value)
    ) {
      deepFreeze(value);
    }
  });
  return obj;
}
