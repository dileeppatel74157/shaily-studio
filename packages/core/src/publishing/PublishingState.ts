// ─── Publishing Lifecycle State ───────────────────────────────────────────────

export enum PublishingState {
  CREATED      = "CREATED",
  INITIALIZED  = "INITIALIZED",
  PREPARING    = "PREPARING",
  VALIDATING   = "VALIDATING",
  SCHEDULING   = "SCHEDULING",
  UPLOADING    = "UPLOADING",
  PROCESSING   = "PROCESSING",
  PUBLISHED    = "PUBLISHED",
  FAILED       = "FAILED",
  CANCELLED    = "CANCELLED",
}
