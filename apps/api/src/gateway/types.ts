import { GatewayState } from "./GatewayState";

export class GatewayException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class GatewayValidationException extends GatewayException {
  constructor(message: string) {
    super(message);
  }
}

export class InvalidGatewayStateException extends GatewayException {
  constructor(action: string, currentState: GatewayState) {
    super(
      `Cannot perform "${action}" because Gateway is in state "${currentState}".`
    );
  }
}

export function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  Object.freeze(obj);

  for (const prop of Object.getOwnPropertyNames(obj)) {
    const value = (obj as any)[prop];

    if (
      value !== null &&
      (typeof value === "object" || typeof value === "function") &&
      !Object.isFrozen(value)
    ) {
      deepFreeze(value);
    }
  }

  return obj;
}
