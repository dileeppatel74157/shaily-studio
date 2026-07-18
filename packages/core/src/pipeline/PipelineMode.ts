// ─── Pipeline Mode ────────────────────────────────────────────────────────────

export enum PipelineMode {
  SEQUENTIAL = "SEQUENTIAL",
  PARALLEL   = "PARALLEL",
  HYBRID     = "HYBRID",
  RESUME     = "RESUME",
  RECOVERY   = "RECOVERY",
  DRY_RUN    = "DRY_RUN",
  SIMULATION = "SIMULATION",
}
