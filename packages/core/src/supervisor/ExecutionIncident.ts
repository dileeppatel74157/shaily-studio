export interface ExecutionIncident {
  readonly id: string;
  readonly sessionId: string;
  readonly type: "limit_exceeded" | "budget_exceeded" | "recovery_failed" | "unhandled_exception";
  readonly details: string;
  readonly severity: "warning" | "error" | "critical";
  readonly timestamp: Date;
}
