import { DatabaseState } from "./DatabaseState";

// ─── Base Exception ───────────────────────────────────────────────────────────

export class DatabaseException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ─── Specific Exceptions ──────────────────────────────────────────────────────

export class ConnectionException extends DatabaseException {
  constructor(message: string) { super(message); }
}

export class TransactionException extends DatabaseException {
  constructor(message: string) { super(message); }
}

export class MigrationException extends DatabaseException {
  constructor(message: string) { super(message); }
}

export class QueryException extends DatabaseException {
  constructor(message: string) { super(message); }
}

export class BackupException extends DatabaseException {
  constructor(message: string) { super(message); }
}

export class RestoreException extends DatabaseException {
  constructor(message: string) { super(message); }
}

export class DatabaseValidationException extends DatabaseException {
  constructor(message: string) { super(message); }
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
export function deepFreeze<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== "object" && typeof obj !== "function") {
    return obj;
  }

  Object.freeze(obj);

  const propNames = Object.getOwnPropertyNames(obj);
  for (const name of propNames) {
    const value = (obj as any)[name];
    if (
      value !== null &&
      value !== undefined &&
      (typeof value === "object" || typeof value === "function") &&
      !Object.isFrozen(value)
    ) {
      deepFreeze(value);
    }
  }

  return obj;
}
