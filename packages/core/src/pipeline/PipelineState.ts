// ─── Pipeline State ──────────────────────────────────────────────────────────

export enum PipelineState {
  CREATED     = "CREATED",
  INITIALIZED = "INITIALIZED",
  RUNNING     = "RUNNING",
  PAUSED      = "PAUSED",
  COMPLETED   = "COMPLETED",
  FAILED      = "FAILED",
  CANCELLED   = "CANCELLED",

  VALIDATING  = "VALIDATING",
  RESEARCHING = "RESEARCHING",
  ANALYZING   = "ANALYZING",
  PLANNING    = "PLANNING",
  SCRIPTING   = "SCRIPTING",
  REVIEWING   = "REVIEWING",
}
