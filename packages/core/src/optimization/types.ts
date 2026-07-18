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

export function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== "object") return obj;
  Object.getOwnPropertyNames(obj).forEach(name => {
    const val = (obj as Record<string, unknown>)[name];
    if (val && typeof val === "object") deepFreeze(val);
  });
  return Object.freeze(obj);
}
