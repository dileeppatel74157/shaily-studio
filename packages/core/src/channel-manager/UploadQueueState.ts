// ─── Upload Queue State ───────────────────────────────────────────────────────

export enum UploadQueueState {
  WAITING   = "WAITING",
  READY     = "READY",
  UPLOADING = "UPLOADING",
  PUBLISHED = "PUBLISHED",
  FAILED    = "FAILED",
  CANCELLED = "CANCELLED",
}
