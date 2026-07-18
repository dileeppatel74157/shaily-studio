// ─── Quality Lifecycle State ──────────────────────────────────────────────────

export enum QualityState {
  CREATED   = "CREATED",
  ANALYZING = "ANALYZING",
  SCORING   = "SCORING",
  FIXING    = "FIXING",
  APPROVED  = "APPROVED",
  REJECTED  = "REJECTED",
  FAILED    = "FAILED",
}
