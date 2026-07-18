// ─── Quality Severity ─────────────────────────────────────────────────────────

export enum QualitySeverity {
  INFO     = "INFO",      // informational only — no action needed
  WARNING  = "WARNING",   // mild issue — auto-fixable
  ERROR    = "ERROR",     // significant issue — may block publish
  CRITICAL = "CRITICAL",  // fatal issue — must be fixed before publish
}
