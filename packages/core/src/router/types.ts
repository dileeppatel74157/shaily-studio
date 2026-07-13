export class RouterException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class RouterValidationException extends RouterException {
  constructor(message: string) {
    super(message);
  }
}
