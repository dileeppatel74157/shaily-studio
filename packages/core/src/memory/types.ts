export class MemoryException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidMemoryException extends MemoryException {
  constructor(message: string) {
    super(message);
  }
}
