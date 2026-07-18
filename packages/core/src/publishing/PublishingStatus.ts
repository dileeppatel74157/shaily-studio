// ─── Publishing Job Status ────────────────────────────────────────────────────

export enum PublishingStatus {
  PENDING   = "PENDING",
  RUNNING   = "RUNNING",
  SUCCESS   = "SUCCESS",
  FAILED    = "FAILED",
  RETRYING  = "RETRYING",
  SCHEDULED = "SCHEDULED",
}
