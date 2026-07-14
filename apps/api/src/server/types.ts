export class ServerException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidServerStateException extends ServerException {
  constructor(action: string, currentState: string) {
    super(`Cannot perform "${action}" because Server is in state "${currentState}".`);
  }
}

export class ServerValidationException extends ServerException {
  constructor(message: string) {
    super(message);
  }
}
