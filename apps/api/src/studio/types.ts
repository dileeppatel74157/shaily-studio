export class StudioException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidStudioStateException extends StudioException {
  constructor(action: string, currentState: string) {
    super(`Cannot perform "${action}" because Studio is in state "${currentState}".`);
  }
}

export class StudioValidationException extends StudioException {
  constructor(message: string) {
    super(message);
  }
}
