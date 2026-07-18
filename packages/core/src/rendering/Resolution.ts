// ─── Resolution Preset ────────────────────────────────────────────────────────

export enum Resolution {
  /** 1280×720 */
  P720   = "720P",
  /** 1920×1080 */
  P1080  = "1080P",
  /** 2560×1440 */
  P1440  = "1440P",
  /** 3840×2160 */
  K4     = "4K",
  /** 7680×4320 */
  K8     = "8K",
  /** User-defined via width/height */
  CUSTOM = "CUSTOM",
}

/** Maps Resolution preset to pixel dimensions */
export const RESOLUTION_DIMENSIONS: Record<Resolution, { width: number; height: number }> = {
  [Resolution.P720]:   { width: 1280,  height: 720  },
  [Resolution.P1080]:  { width: 1920,  height: 1080 },
  [Resolution.P1440]:  { width: 2560,  height: 1440 },
  [Resolution.K4]:     { width: 3840,  height: 2160 },
  [Resolution.K8]:     { width: 7680,  height: 4320 },
  [Resolution.CUSTOM]: { width: 1920,  height: 1080 }, // default fallback
};
