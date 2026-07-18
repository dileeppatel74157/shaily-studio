// ─── Optimization State ──────────────────────────────────────────────────────

export enum OptimizationState {
  CREATED     = "CREATED",
  INITIALIZED = "INITIALIZED",
  RUNNING     = "RUNNING",
  PAUSED      = "PAUSED",
  COMPLETED   = "COMPLETED",
  FAILED      = "FAILED",
  CANCELLED   = "CANCELLED",
}
