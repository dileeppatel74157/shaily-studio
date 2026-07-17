export class ChannelException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ChannelValidationException extends ChannelException {
  constructor(message: string) {
    super(message);
  }
}

export class DuplicateChannelException extends ChannelException {
  constructor(channelId: string) {
    super(`Channel profile with ID "${channelId}" is already registered.`);
  }
}

export class InvalidChannelStateException extends ChannelException {
  constructor(channelId: string, action: string, currentState: string) {
    super(
      `Cannot perform "${action}" on channel "${channelId}" because it is currently in state "${currentState}".`
    );
  }
}

export function deepFreeze<T>(obj: any): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    if (prop === "context") return;
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
