// ─── Rendering Lifecycle State ────────────────────────────────────────────────

export enum RenderingState {
  CREATED     = "CREATED",
  INITIALIZED = "INITIALIZED",
  PREPARING   = "PREPARING",
  RENDERING   = "RENDERING",
  ENCODING    = "ENCODING",
  EXPORTING   = "EXPORTING",
  COMPLETED   = "COMPLETED",
  FAILED      = "FAILED",
  CANCELLED   = "CANCELLED",
}
