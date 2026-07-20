import {
  AnalyticsRecord,
  MetricSnapshot,
  TrendAnalysis,
  LearningDataset,
  AnalyticsValidationReport,
  AnalyticsValidationIssue,
  RevenueEstimate,
  SubscriberGrowth,
  CTRReport
} from "./models";
import { ValidationException } from "./types";
import { AnalyticsPlatform } from "./AnalyticsPlatform";
import { AggregationType } from "./AggregationType";

export class AnalyticsValidator {
  public static validate(
    record: AnalyticsRecord,
    registeredPlatforms: AnalyticsPlatform[]
  ): AnalyticsValidationReport {
    const issues: AnalyticsValidationIssue[] = [];

    // 1. Record ID required
    if (!record.id || record.id.trim() === "") {
      issues.push({ field: "id", message: "Record ID is required.", severity: "CRITICAL" });
    }

    // 2. Content ID required
    if (!record.contentId || record.contentId.trim() === "") {
      issues.push({ field: "contentId", message: "Content ID is required.", severity: "CRITICAL" });
    }

    // 3. Title required
    if (!record.title || record.title.trim() === "") {
      issues.push({ field: "title", message: "Title is required.", severity: "CRITICAL" });
    }

    // 4. Timestamp valid (publishedAt)
    if (!record.publishedAt || record.publishedAt.getTime() > Date.now()) {
      issues.push({ field: "publishedAt", message: "Published time must be in the past or present.", severity: "CRITICAL" });
    }

    // Iterate snapshots
    for (const platform of record.platforms) {
      // 5. Platform supported
      if (!registeredPlatforms.includes(platform)) {
        issues.push({ field: "platforms", message: `Platform ${platform} has no registered collector.`, severity: "CRITICAL" });
      }

      const snapshots = record.snapshots[platform];
      if (snapshots) {
        let prevTime = 0;
        for (const snap of snapshots) {
          // 6. Metric value >= 0
          const m = snap.metrics;
          if (m.views < 0) issues.push({ field: "metrics.views", message: "Views cannot be negative.", severity: "CRITICAL" });
          if (m.impressions < 0) issues.push({ field: "metrics.impressions", message: "Impressions cannot be negative.", severity: "CRITICAL" });
          if (m.watchTimeSeconds < 0) issues.push({ field: "metrics.watchTimeSeconds", message: "Watch time cannot be negative.", severity: "CRITICAL" });

          // 7. CTR <= 100%
          if (m.ctrPercent < 0 || m.ctrPercent > 100) {
            issues.push({ field: "metrics.ctrPercent", message: "CTR must be between 0% and 100%.", severity: "CRITICAL" });
          }

          // 8. Retention <= 100%
          if (snap.videoMetrics) {
            const v = snap.videoMetrics;
            if (v.completionRatePercent < 0 || v.completionRatePercent > 100) {
              issues.push({ field: "videoMetrics.completionRatePercent", message: "Completion rate must be between 0% and 100%.", severity: "CRITICAL" });
            }
          }

          // 9. Duplicate metric prevention (ordered snapshots timestamp unique check)
          const snapTime = snap.timestamp.getTime();
          if (snapTime === prevTime) {
            issues.push({ field: "snapshots", message: "Duplicate metric snapshot found at the same timestamp.", severity: "CRITICAL" });
          }
          prevTime = snapTime;

          // 10. Impressions >= views
          if (m.impressions < m.views) {
            issues.push({ field: "metrics.impressions", message: "Impressions must be greater than or equal to views.", severity: "WARNING" });
          }
        }
      }
    }

    const valid = !issues.some(i => i.severity === "CRITICAL");
    return {
      valid,
      issues,
      timestamp: new Date()
    };
  }

  public static assertValid(record: AnalyticsRecord, registeredPlatforms: AnalyticsPlatform[]): void {
    const report = this.validate(record, registeredPlatforms);
    if (!report.valid) {
      const crit = report.issues.find(i => i.severity === "CRITICAL");
      throw new ValidationException(`Validation failed: ${crit?.message}`);
    }
  }

  // Extra validator rules
  public static validateTrend(trend: TrendAnalysis): void {
    // 11. Confidence score between 0 and 1
    if (trend.confidenceScore < 0 || trend.confidenceScore > 1) {
      throw new ValidationException("Trend confidence score must be between 0.0 and 1.0.");
    }
    // 12. Period days positive
    if (trend.periodDays <= 0) {
      throw new ValidationException("Trend period days must be positive.");
    }
  }

  public static validateDataset(dataset: LearningDataset): void {
    // 13. Dataset features count matches labels count
    if (dataset.features.length !== dataset.labels.length) {
      throw new ValidationException("Dataset features count must match labels count.");
    }
    // 14. Dataset count matches lists lengths
    if (dataset.count !== dataset.features.length) {
      throw new ValidationException("Dataset count mismatch.");
    }
  }

  public static validateAggregation(type: AggregationType): void {
    // 15. Aggregation period valid
    if (!Object.values(AggregationType).includes(type)) {
      throw new ValidationException("Invalid aggregation period type.");
    }
  }

  public static validateSnapshot(snap: MetricSnapshot): void {
    // 16. Snapshot metrics initialized
    if (!snap.metrics) {
      throw new ValidationException("Metric snapshot must contain metrics.");
    }
  }

  public static validateRevenue(rev: RevenueEstimate): void {
    // 17. CPM positive
    if (rev.cpmUsd < 0) throw new ValidationException("CPM cannot be negative.");
    // 18. RPM positive
    if (rev.rpmUsd < 0) throw new ValidationException("RPM cannot be negative.");
  }

  public static validateGrowth(growth: SubscriberGrowth): void {
    // 19. Total followers positive
    if (growth.totalFollowers < 0) throw new ValidationException("Total followers cannot be negative.");
  }

  public static validateCtrReport(report: CTRReport): void {
    // 20. Ctr matches count math
    if (report.impressions > 0 && Math.abs((report.clicks / report.impressions) * 100 - report.ctrPercent) > 1.0) {
      throw new ValidationException("CTR report percent mismatch with clicks/impressions math.");
    }
  }
}
