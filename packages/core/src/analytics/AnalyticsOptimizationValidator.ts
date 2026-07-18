import { OptimizationRequest } from "./optimization-models";
import { AnalyticsResponse }   from "./models";
import { TrendPrediction }     from "./optimization-models";
import { AnalyticsPlatform }   from "./AnalyticsPlatform";

class OptimizationValidationException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OptimizationValidationException";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export { OptimizationValidationException };

export class AnalyticsOptimizationValidator {

  // ─── Request ──────────────────────────────────────────────────────────────

  public static validateRequest(request: OptimizationRequest): void {
    if (!request.id || request.id.trim().length === 0) {
      throw new OptimizationValidationException("OptimizationRequest must have a non-empty ID.");
    }
    if (!Array.isArray(request.platforms) || request.platforms.length === 0) {
      throw new OptimizationValidationException("OptimizationRequest must include at least one platform.");
    }
    for (const p of request.platforms) {
      if (!Object.values(AnalyticsPlatform).includes(p)) {
        throw new OptimizationValidationException(`Invalid platform "${p}" in OptimizationRequest.`);
      }
    }
    if (request.timestamp > new Date()) {
      throw new OptimizationValidationException("OptimizationRequest timestamp cannot be in the future.");
    }
    if (request.options.windowDays !== undefined) {
      if (request.options.windowDays < 1 || request.options.windowDays > 365) {
        throw new OptimizationValidationException("windowDays must be between 1 and 365.");
      }
    }
  }

  // ─── Analytics History ────────────────────────────────────────────────────

  public static validateHistory(history: AnalyticsResponse[]): void {
    if (!Array.isArray(history)) {
      throw new OptimizationValidationException("Analytics history must be an array.");
    }
    // Check for duplicate IDs
    const seen = new Set<string>();
    for (const r of history) {
      if (!r.requestId) throw new OptimizationValidationException("Every AnalyticsResponse must have a requestId.");
      if (seen.has(r.requestId)) {
        throw new OptimizationValidationException(`Duplicate analytics requestId "${r.requestId}" in history.`);
      }
      seen.add(r.requestId);
    }
    // Validate metrics
    for (const r of history) {
      const m = r.platformAnalytics?.normalizedMetrics;
      if (!m) continue;
      if (m.views < 0) throw new OptimizationValidationException(`Negative views in response "${r.requestId}".`);
      if (m.ctrPercent < 0 || m.ctrPercent > 100) throw new OptimizationValidationException(`CTR out of range [0,100] in "${r.requestId}".`);
      if (m.averageRetentionPercent < 0 || m.averageRetentionPercent > 100) {
        throw new OptimizationValidationException(`Retention out of range [0,100] in "${r.requestId}".`);
      }
      if (m.revenueUsd < 0) throw new OptimizationValidationException(`Negative revenue in "${r.requestId}".`);
      if (r.timestamp > new Date()) throw new OptimizationValidationException(`Future timestamp in response "${r.requestId}".`);
    }
  }

  // ─── Prediction Confidence ────────────────────────────────────────────────

  public static validatePredictionConfidence(predictions: TrendPrediction[]): void {
    for (const pred of predictions) {
      if (pred.confidence < 0 || pred.confidence > 1) {
        throw new OptimizationValidationException(
          `Prediction "${pred.id}" has confidence ${pred.confidence} out of [0, 1].`
        );
      }
      if (pred.horizonDays < 1 || pred.horizonDays > 365) {
        throw new OptimizationValidationException(
          `Prediction "${pred.id}" horizonDays ${pred.horizonDays} must be between 1 and 365.`
        );
      }
    }
  }

  // ─── A/B Test ─────────────────────────────────────────────────────────────

  public static validateABTest(test: import("./optimization-models").ABTest): void {
    if (!test.id || test.id.trim().length === 0) {
      throw new OptimizationValidationException("ABTest must have a non-empty ID.");
    }
    if (!test.variants || test.variants.length < 2) {
      throw new OptimizationValidationException(`ABTest "${test.id}" must have at least 2 variants.`);
    }
    const ids = new Set(test.variants.map(v => v.id));
    if (ids.size !== test.variants.length) {
      throw new OptimizationValidationException(`ABTest "${test.id}" has duplicate variant IDs.`);
    }
    if (test.durationDays < 1) {
      throw new OptimizationValidationException(`ABTest "${test.id}" durationDays must be ≥ 1.`);
    }
    if (test.minViewsThreshold !== undefined && test.minViewsThreshold < 0) {
      throw new OptimizationValidationException(`ABTest "${test.id}" minViewsThreshold must be ≥ 0.`);
    }
  }

  // ─── Snapshot Consistency ─────────────────────────────────────────────────

  public static validateSnapshot(snap: import("./optimization-models").AnalyticsSnapshotEntry): void {
    if (!snap.platformVideoId) {
      throw new OptimizationValidationException("AnalyticsSnapshotEntry must have a platformVideoId.");
    }
    if (snap.windowStart > snap.windowEnd) {
      throw new OptimizationValidationException(`Snapshot "${snap.id}" windowStart is after windowEnd.`);
    }
    if (snap.metrics.views < 0) {
      throw new OptimizationValidationException(`Snapshot "${snap.id}" has negative views.`);
    }
    if (snap.score.overall < 0 || snap.score.overall > 100) {
      throw new OptimizationValidationException(`Snapshot "${snap.id}" score ${snap.score.overall} is out of [0, 100].`);
    }
  }
}
