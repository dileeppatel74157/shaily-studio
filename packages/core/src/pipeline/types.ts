// ─── Pipeline Exception Hierarchy ─────────────────────────────────────────────

export class PipelineException extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = "PipelineException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class StageException extends PipelineException {
  constructor(message: string) {
    super(message, "STAGE_ERROR");
    this.name = "StageException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class SchedulerException extends PipelineException {
  constructor(message: string) {
    super(message, "SCHEDULER_ERROR");
    this.name = "SchedulerException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class RecoveryException extends PipelineException {
  constructor(message: string) {
    super(message, "RECOVERY_ERROR");
    this.name = "RecoveryException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class PipelineValidationException extends PipelineException {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR");
    this.name = "PipelineValidationException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ─── Deep Freeze Utility ──────────────────────────────────────────────────────

function isPlainObjectOrArray(value: unknown): boolean {
  if (Array.isArray(value)) return true;
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
export function deepFreeze<T>(obj: T): Readonly<T> {
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
