// ─── Optimization Engine Exception Hierarchy ──────────────────────────────────

export class OptimizationException extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = "OptimizationException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class RuleException extends OptimizationException {
  constructor(message: string) {
    super(message, "RULE_ERROR");
    this.name = "RuleException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ImpactException extends OptimizationException {
  constructor(message: string) {
    super(message, "IMPACT_ERROR");
    this.name = "ImpactException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class RollbackException extends OptimizationException {
  constructor(message: string) {
    super(message, "ROLLBACK_ERROR");
    this.name = "RollbackException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class OptimizationValidationException extends OptimizationException {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR");
    this.name = "OptimizationValidationException";
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
