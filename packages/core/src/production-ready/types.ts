// ─── Production Ready Exception Hierarchy ─────────────────────────────────────

export class ProductionReadyException extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = "ProductionReadyException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationException extends ProductionReadyException {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR");
    this.name = "ValidationException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BenchmarkException extends ProductionReadyException {
  constructor(message: string) {
    super(message, "BENCHMARK_ERROR");
    this.name = "BenchmarkException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class CertificationException extends ProductionReadyException {
  constructor(message: string) {
    super(message, "CERTIFICATION_ERROR");
    this.name = "CertificationException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ProductionValidationException extends ProductionReadyException {
  constructor(message: string) {
    super(message, "VALIDATION_RULE_ERROR");
    this.name = "ProductionValidationException";
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
