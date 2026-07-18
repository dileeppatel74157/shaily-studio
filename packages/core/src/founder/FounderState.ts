// ─── Founder Engine Lifecycle State ──────────────────────────────────────────

export enum FounderState {
  CREATED    = "CREATED",
  INITIALIZED= "INITIALIZED",
  RUNNING    = "RUNNING",
  PAUSED     = "PAUSED",
  STOPPED    = "STOPPED",
  FAILED     = "FAILED",
  RECOVERING = "RECOVERING",
}
