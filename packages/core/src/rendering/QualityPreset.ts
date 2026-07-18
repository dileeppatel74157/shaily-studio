// ─── Quality Preset ───────────────────────────────────────────────────────────

export enum QualityPreset {
  DRAFT    = "DRAFT",    // fast, low bitrate — for preview
  FAST     = "FAST",     // balanced speed/quality
  STANDARD = "STANDARD", // default production quality
  HIGH     = "HIGH",     // high fidelity
  LOSSLESS = "LOSSLESS", // archival quality
}

/** CRF (Constant Rate Factor) values per preset for H264/H265 (lower = better) */
export const QUALITY_CRF: Record<QualityPreset, number> = {
  [QualityPreset.DRAFT]:    35,
  [QualityPreset.FAST]:     28,
  [QualityPreset.STANDARD]: 23,
  [QualityPreset.HIGH]:     18,
  [QualityPreset.LOSSLESS]:  0,
};
