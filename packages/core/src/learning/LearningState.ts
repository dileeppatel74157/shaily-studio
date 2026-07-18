// ─── Learning Lifecycle State ────────────────────────────────────────────────

export enum LearningState {
  CREATED     = "CREATED",
  INITIALIZED = "INITIALIZED",
  COLLECTING  = "COLLECTING",
  ANALYZING   = "ANALYZING",
  LEARNING    = "LEARNING",
  APPLYING    = "APPLYING",
  COMPLETED   = "COMPLETED",
  FAILED      = "FAILED",
  CANCELLED   = "CANCELLED",
}
