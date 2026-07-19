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
export function deepFreeze<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object" && typeof obj !== "function") return obj;
  Object.freeze(obj);
  for (const key of Object.getOwnPropertyNames(obj)) {
    const val = (obj as any)[key];
    if (val && (typeof val === "object" || typeof val === "function") && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}
