import { MemoryOptimizationState } from "./MemoryOptimizationState";

export class MemoryOptimizationException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class MemoryEntryNotFoundException extends MemoryOptimizationException {
  constructor(id: string) {
    super(`Memory entry "${id}" was not found.`);
  }
}

export class ArchiveNotFoundException extends MemoryOptimizationException {
  constructor(id: string) {
    super(`Archive "${id}" was not found.`);
  }
}

export class CompressionException extends MemoryOptimizationException {
  constructor(message: string) {
    super(`Compression error: ${message}`);
  }
}

export class DeduplicationException extends MemoryOptimizationException {
  constructor(message: string) {
    super(`Deduplication error: ${message}`);
  }
}

export class RestoreException extends MemoryOptimizationException {
  constructor(message: string) {
    super(`Restore error: ${message}`);
  }
}

export class MemoryOptimizationValidationException extends MemoryOptimizationException {
  constructor(message: string) {
    super(message);
  }
}

export class InvalidMemoryOptimizationStateException extends MemoryOptimizationException {
  constructor(action: string, state: MemoryOptimizationState) {
    super(`Cannot "${action}" while engine is in state "${state}".`);
  }
}

/** Simple deterministic string hash (djb2). */
export function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0; // unsigned 32-bit
  }
  return hash.toString(16);
}

/** Deeply freeze an object. */
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
