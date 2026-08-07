export enum MCPServerState {
  CREATED = "CREATED",
  READY = "READY",
  RUNNING = "RUNNING",
  STOPPED = "STOPPED",
  FAILED = "FAILED",
}

export class MCPException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class MCPValidationException extends MCPException {
  constructor(message: string) {
    super(message);
  }
}

export class InvalidMCPStateException extends MCPException {
  constructor(action: string, currentState: MCPServerState) {
    super(
      `Cannot perform "${action}" because MCPServer is in state "${currentState}".`
    );
  }
}

function isPlainObjectOrArray(value: unknown): boolean {
  if (Array.isArray(value)) return true;
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
export function deepFreeze<T>(obj: any): T {
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
