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

export function deepFreeze<T>(obj: any): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    if (
      obj.hasOwnProperty(prop) &&
      obj[prop] !== null &&
      (typeof obj[prop] === "object" || typeof obj[prop] === "function") &&
      !Object.isFrozen(obj[prop])
    ) {
      deepFreeze(obj[prop]);
    }
  });
  return obj;
}
