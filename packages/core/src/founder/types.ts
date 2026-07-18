// ─── Founder Exception Hierarchy ─────────────────────────────────────────────

export class FounderException extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = "FounderException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class DashboardException extends FounderException {
  constructor(message: string) {
    super(message, "DASHBOARD_ERROR");
    this.name = "DashboardException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AlertException extends FounderException {
  constructor(message: string) {
    super(message, "ALERT_ERROR");
    this.name = "AlertException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class TimelineException extends FounderException {
  constructor(message: string) {
    super(message, "TIMELINE_ERROR");
    this.name = "TimelineException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class WorkspaceException extends FounderException {
  constructor(message: string) {
    super(message, "WORKSPACE_ERROR");
    this.name = "WorkspaceException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class FounderValidationException extends FounderException {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR");
    this.name = "FounderValidationException";
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
