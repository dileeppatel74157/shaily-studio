// ─── Composition Lifecycle State ─────────────────────────────────────────────

export enum CompositionState {
  CREATED     = "CREATED",
  INITIALIZED = "INITIALIZED",
  COMPOSING   = "COMPOSING",
  SYNCING     = "SYNCING",
  READY       = "READY",
  RENDERING   = "RENDERING",
  COMPLETED   = "COMPLETED",
  FAILED      = "FAILED",
}
