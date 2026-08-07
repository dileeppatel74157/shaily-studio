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
