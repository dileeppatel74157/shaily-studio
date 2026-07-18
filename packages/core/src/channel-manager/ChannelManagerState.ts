// ─── Channel Manager Lifecycle State ─────────────────────────────────────────

export enum ChannelManagerState {
  CREATED      = "CREATED",
  INITIALIZED  = "INITIALIZED",
  CONNECTING   = "CONNECTING",
  CONNECTED    = "CONNECTED",
  SYNCING      = "SYNCING",
  READY        = "READY",
  RUNNING      = "RUNNING",
  PAUSED       = "PAUSED",
  FAILED       = "FAILED",
  DISCONNECTED = "DISCONNECTED",
}
