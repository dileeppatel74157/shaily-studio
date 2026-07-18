// ─── Pipeline Status ──────────────────────────────────────────────────────────

export enum PipelineStatus {
  PENDING   = "PENDING",
  RUNNING   = "RUNNING",
  SUCCESS   = "SUCCESS",
  FAILED    = "FAILED",
  RETRYING  = "RETRYING",
  SCHEDULED = "SCHEDULED",
}
