import { DatabaseState } from "./DatabaseState";

// ─── Base Exception ───────────────────────────────────────────────────────────

export class DatabaseException extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ─── Specific Exceptions ──────────────────────────────────────────────────────

export class ConnectionException extends DatabaseException {
  constructor(message: string, cause?: Error) { super(message, cause); }
}

export class TransactionException extends DatabaseException {
  constructor(message: string, cause?: Error) { super(message, cause); }
}

export class MigrationException extends DatabaseException {
  constructor(message: string, cause?: Error) { super(message, cause); }
}

export class QueryException extends DatabaseException {
  constructor(message: string, cause?: Error) { super(message, cause); }
}

export class BackupException extends DatabaseException {
  constructor(message: string, cause?: Error) { super(message, cause); }
}

export class RestoreException extends DatabaseException {
  constructor(message: string, cause?: Error) { super(message, cause); }
}

export class DatabaseValidationException extends DatabaseException {
  constructor(message: string, cause?: Error) { super(message, cause); }
}

export class InvalidDatabaseStateException extends DatabaseException {
  constructor(action: string, currentState: DatabaseState) {
    super(`Cannot perform action "${action}" while DatabaseEngine is in state "${currentState}".`);
  }
}

// ─── deepFreeze utility ───────────────────────────────────────────────────────

/**
 * Recursively freezes an object and all nested objects to enforce immutability.
 */
function isPlainObjectOrArray(value: unknown): boolean {
  if (Array.isArray(value)) return true;
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
export function deepFreeze<T>(obj: T): T {
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
