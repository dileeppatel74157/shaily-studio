// ─── Control Center Exception Hierarchy ───────────────────────────────────────

export class ControlException extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = "ControlException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class OverrideException extends ControlException {
  constructor(message: string) {
    super(message, "OVERRIDE_ERROR");
    this.name = "OverrideException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BudgetException extends ControlException {
  constructor(message: string) {
    super(message, "BUDGET_ERROR");
    this.name = "BudgetException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class EmergencyException extends ControlException {
  constructor(message: string) {
    super(message, "EMERGENCY_ERROR");
    this.name = "EmergencyException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class PermissionException extends ControlException {
  constructor(message: string) {
    super(message, "PERMISSION_ERROR");
    this.name = "PermissionException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ExecutionException extends ControlException {
  constructor(message: string) {
    super(message, "EXECUTION_ERROR");
    this.name = "ExecutionException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ControlValidationException extends ControlException {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR");
    this.name = "ControlValidationException";
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
