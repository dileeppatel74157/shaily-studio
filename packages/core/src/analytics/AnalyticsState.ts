// ─── Analytics Lifecycle State ────────────────────────────────────────────────

export enum AnalyticsState {
  CREATED      = "CREATED",
  INITIALIZED  = "INITIALIZED",
  COLLECTING   = "COLLECTING",
  PROCESSING   = "PROCESSING",
  ANALYZING    = "ANALYZING",
  REPORTING    = "REPORTING",
  COMPLETED    = "COMPLETED",
  FAILED       = "FAILED",
  CANCELLED    = "CANCELLED",
}
