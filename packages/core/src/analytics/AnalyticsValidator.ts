import { AnalyticsRequest, AnalyticsRecommendation, PerformanceScore } from "./models";
import { AnalyticsState }    from "./AnalyticsState";
import { AnalyticsPlatform } from "./AnalyticsPlatform";
import {
  AnalyticsValidationException,
  DuplicateAnalyticsException,
} from "./types";

export class AnalyticsValidator {

  // ─── Request Validation ─────────────────────────────────────────────────────

  public static validateRequest(request: AnalyticsRequest): void {
    if (!request.id || request.id.trim().length === 0) {
      throw new AnalyticsValidationException(
        "AnalyticsRequest must have a non-empty ID."
      );
    }
    if (!request.publishingId || request.publishingId.trim().length === 0) {
      throw new AnalyticsValidationException(
        `AnalyticsRequest "${request.id}" must reference a non-empty publishingId.`
      );
    }
    if (!request.platformVideoId || request.platformVideoId.trim().length === 0) {
      throw new AnalyticsValidationException(
        `AnalyticsRequest "${request.id}" must provide a non-empty platformVideoId.`
      );
    }
    // Validate platform is a known value
    if (!Object.values(AnalyticsPlatform).includes(request.platform)) {
      throw new AnalyticsValidationException(
        `AnalyticsRequest "${request.id}" has an invalid platform "${request.platform}". ` +
        `Must be one of: ${Object.values(AnalyticsPlatform).join(", ")}.`
      );
    }
    // Collection window bounds
    const window = request.options?.collectionWindowDays;
    if (window !== undefined && (window < 1 || window > 365)) {
      throw new AnalyticsValidationException(
        `AnalyticsRequest "${request.id}" collectionWindowDays must be between 1 and 365 (got ${window}).`
      );
    }
    // Timestamp must not be in the future
    if (request.timestamp > new Date()) {
      throw new AnalyticsValidationException(
        `AnalyticsRequest "${request.id}" timestamp cannot be in the future.`
      );
    }
  }

  // ─── Performance Score Validation ───────────────────────────────────────────

  public static validatePerformanceScore(score: PerformanceScore): void {
    const fields: Array<keyof PerformanceScore> = [
      "overall", "hook", "retention", "engagement", "ctr", "growth", "revenue", "reach"
    ];
    for (const field of fields) {
      const val = score[field] as number;
      if (typeof val !== "number" || val < 0 || val > 100) {
        throw new AnalyticsValidationException(
          `PerformanceScore.${field} must be a number between 0 and 100 (got ${val}).`
        );
      }
    }
  }

  // ─── Metric Validation ───────────────────────────────────────────────────────

  public static validateMetrics(metrics: {
    views: number;
    ctrPercent: number;
    averageRetentionPercent: number;
    revenueUsd: number;
    engagementRate: number;
  }): void {
    if (metrics.views < 0) {
      throw new AnalyticsValidationException("Views cannot be negative.");
    }
    if (metrics.revenueUsd < 0) {
      throw new AnalyticsValidationException("Revenue cannot be negative.");
    }
    if (metrics.ctrPercent < 0 || metrics.ctrPercent > 100) {
      throw new AnalyticsValidationException(
        `CTR must be between 0 and 100 (got ${metrics.ctrPercent}).`
      );
    }
    if (metrics.averageRetentionPercent < 0 || metrics.averageRetentionPercent > 100) {
      throw new AnalyticsValidationException(
        `Average retention must be between 0 and 100 (got ${metrics.averageRetentionPercent}).`
      );
    }
    if (metrics.engagementRate < 0 || metrics.engagementRate > 100) {
      throw new AnalyticsValidationException(
        `Engagement rate must be between 0 and 100 (got ${metrics.engagementRate}).`
      );
    }
  }

  // ─── Retention Curve Validation ──────────────────────────────────────────────

  public static validateRetentionCurve(dataPoints: Array<{ secondMark: number; retentionPercent: number }>): void {
    for (const dp of dataPoints) {
      if (dp.secondMark < 0) {
        throw new AnalyticsValidationException(
          `Retention data point has invalid timestamp: ${dp.secondMark}s (must be >= 0).`
        );
      }
      if (dp.retentionPercent < 0 || dp.retentionPercent > 100) {
        throw new AnalyticsValidationException(
          `Retention data point at ${dp.secondMark}s has invalid percentage: ${dp.retentionPercent} (must be 0–100).`
        );
      }
    }
    // Retention should generally be non-increasing
    for (let i = 1; i < dataPoints.length; i++) {
      if (dataPoints[i].retentionPercent > dataPoints[i - 1].retentionPercent + 5) {
        throw new AnalyticsValidationException(
          `Invalid retention curve: retention increased sharply at second ${dataPoints[i].secondMark} ` +
          `(${dataPoints[i - 1].retentionPercent}% → ${dataPoints[i].retentionPercent}%). ` +
          `Spikes of more than 5% are not valid for a standard retention graph.`
        );
      }
    }
  }

  // ─── Recommendations Validation ──────────────────────────────────────────────

  public static validateRecommendations(recs: AnalyticsRecommendation[]): void {
    const seenIds = new Set<string>();
    for (const rec of recs) {
      if (!rec.id || rec.id.trim().length === 0) {
        throw new AnalyticsValidationException("AnalyticsRecommendation must have a non-empty ID.");
      }
      if (seenIds.has(rec.id)) {
        throw new DuplicateAnalyticsException(rec.id);
      }
      seenIds.add(rec.id);

      if (rec.expectedImpactPercent < 0 || rec.expectedImpactPercent > 100) {
        throw new AnalyticsValidationException(
          `Recommendation "${rec.id}" expectedImpactPercent must be 0–100 (got ${rec.expectedImpactPercent}).`
        );
      }
    }
  }

  // ─── State Transition Validation ─────────────────────────────────────────────

  private static readonly VALID_TRANSITIONS: Record<AnalyticsState, AnalyticsState[]> = {
    [AnalyticsState.CREATED]:     [AnalyticsState.INITIALIZED],
    [AnalyticsState.INITIALIZED]: [AnalyticsState.COLLECTING, AnalyticsState.CANCELLED],
    [AnalyticsState.COLLECTING]:  [AnalyticsState.PROCESSING, AnalyticsState.FAILED, AnalyticsState.CANCELLED],
    [AnalyticsState.PROCESSING]:  [AnalyticsState.ANALYZING, AnalyticsState.FAILED],
    [AnalyticsState.ANALYZING]:   [AnalyticsState.REPORTING, AnalyticsState.FAILED],
    [AnalyticsState.REPORTING]:   [AnalyticsState.COMPLETED, AnalyticsState.FAILED],
    [AnalyticsState.COMPLETED]:   [],
    [AnalyticsState.FAILED]:      [AnalyticsState.COLLECTING], // can retry
    [AnalyticsState.CANCELLED]:   [],
  };

  public static validateStateTransition(
    jobId: string,
    from: AnalyticsState,
    to: AnalyticsState
  ): void {
    const allowed = this.VALID_TRANSITIONS[from] || [];
    if (!allowed.includes(to)) {
      throw new AnalyticsValidationException(
        `Invalid state transition for analytics job "${jobId}": "${from}" → "${to}". ` +
        `Allowed transitions: [${allowed.join(", ")}].`
      );
    }
  }
}
