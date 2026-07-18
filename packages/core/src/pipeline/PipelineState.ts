// ─── Pipeline State ──────────────────────────────────────────────────────────

export enum PipelineState {
  CREATED     = "CREATED",
  INITIALIZED = "INITIALIZED",
  RUNNING     = "RUNNING",
  PAUSED      = "PAUSED",
  COMPLETED   = "COMPLETED",
  FAILED      = "FAILED",
  CANCELLED   = "CANCELLED",
}
