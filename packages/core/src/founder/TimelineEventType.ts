// ─── Timeline Event Type ──────────────────────────────────────────────────────

export enum TimelineEventType {
  START         = "START",
  FINISH        = "FINISH",
  ERROR         = "ERROR",
  RETRY         = "RETRY",
  CHECKPOINT    = "CHECKPOINT",
  USER_ACTION   = "USER_ACTION",
  SYSTEM_ACTION = "SYSTEM_ACTION",
}
