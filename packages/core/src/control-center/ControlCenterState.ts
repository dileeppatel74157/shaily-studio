// ─── Control Center Lifecycle State ──────────────────────────────────────────

export enum ControlCenterState {
  CREATED        = "CREATED",
  INITIALIZED    = "INITIALIZED",
  MONITORING     = "MONITORING",
  ACTIVE         = "ACTIVE",
  PAUSED         = "PAUSED",
  EMERGENCY_STOP = "EMERGENCY_STOP",
  RECOVERING     = "RECOVERING",
  COMPLETED      = "COMPLETED",
  FAILED         = "FAILED",
}
