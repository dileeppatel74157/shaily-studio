import { QualityRequest, QualityResponse, QualityIssue, QualityReport } from "./models";
import { QualityState } from "./QualityState";
import { QualityValidationException, DuplicateQualityException } from "./types";

export class QualityValidator {
  public static validateRequest(request: QualityRequest): void {
    if (!request.id || request.id.trim().length === 0) {
      throw new QualityValidationException("QualityRequest must have a non-empty ID.");
    }
    if (!request.renderId || request.renderId.trim().length === 0) {
      throw new QualityValidationException(
        `QualityRequest "${request.id}" must reference a non-empty renderId.`
      );
    }
  }

  public static validateResponse(response: QualityResponse): void {
    if (!response.id || response.id.trim().length === 0) {
      throw new QualityValidationException("QualityResponse must have a non-empty ID.");
    }
    this.validateScores(response.score);
    this.validateMetrics(response);
  }

  public static validateScores(score: {
    overall: number;
    visual: number;
    audio: number;
    subtitle: number;
    brand: number;
    thumbnail: number;
    content: number;
    retention: number;
  }): void {
    const scores = Object.entries(score);
    for (const [key, val] of scores) {
      if (val < 0 || val > 100) {
        throw new QualityValidationException(
          `Invalid score range for ${key}: ${val}. Score must be between 0 and 100.`
        );
      }
    }
  }

  public static validateIssues(issues: QualityIssue[]): void {
    const issueIds = new Set<string>();
    for (const issue of issues) {
      if (!issue.id || issue.id.trim().length === 0) {
        throw new QualityValidationException("QualityIssue must have a non-empty ID.");
      }
      if (issueIds.has(issue.id)) {
        throw new DuplicateQualityException(
          `Duplicate issue ID detected: "${issue.id}"`
        );
      }
      issueIds.add(issue.id);

      if (issue.timestampSeconds !== undefined && issue.timestampSeconds < 0) {
        throw new QualityValidationException(
          `Invalid timestamp for issue "${issue.id}": ${issue.timestampSeconds}. Timestamp cannot be negative.`
        );
      }
    }
  }

  public static validateReport(report: QualityReport): void {
    if (!report.id || report.id.trim().length === 0) {
      throw new QualityValidationException("QualityReport must have a non-empty ID.");
    }
  }

  public static validateMetrics(response: QualityResponse): void {
    const metrics = response.metrics;
    const allIssues = response.report.allIssues;

    // Check count consistency
    if (metrics.totalIssues !== allIssues.length) {
      throw new QualityValidationException(
        `Inconsistent metrics: totalIssues (${metrics.totalIssues}) does not match report issues count (${allIssues.length}).`
      );
    }

    // Verify dimension scores match
    const scores = response.score;
    const metricScores = metrics.scoresByDimension;
    if (
      metricScores.overall !== scores.overall ||
      metricScores.visual !== scores.visual ||
      metricScores.audio !== scores.audio ||
      metricScores.subtitle !== scores.subtitle ||
      metricScores.brand !== scores.brand ||
      metricScores.thumbnail !== scores.thumbnail ||
      metricScores.content !== scores.content
    ) {
      throw new QualityValidationException(
        "Inconsistent metrics: Dimension scores in metrics do not match response scores."
      );
    }
  }

  private static readonly VALID_TRANSITIONS: Record<QualityState, QualityState[]> = {
    [QualityState.CREATED]: [QualityState.ANALYZING],
    [QualityState.ANALYZING]: [QualityState.SCORING, QualityState.FAILED],
    [QualityState.SCORING]: [QualityState.FIXING, QualityState.APPROVED, QualityState.REJECTED, QualityState.FAILED],
    [QualityState.FIXING]: [QualityState.ANALYZING, QualityState.APPROVED, QualityState.REJECTED, QualityState.FAILED],
    [QualityState.APPROVED]: [],
    [QualityState.REJECTED]: [QualityState.ANALYZING], // Can be re-analyzed after manual changes
    [QualityState.FAILED]: [QualityState.ANALYZING],
  };

  public static validateStateTransition(
    qualityId: string,
    from: QualityState,
    to: QualityState
  ): void {
    const allowed = this.VALID_TRANSITIONS[from] || [];
    if (!allowed.includes(to)) {
      throw new QualityValidationException(
        `Invalid state transition for quality review "${qualityId}": "${from}" → "${to}". ` +
        `Allowed transitions: [${allowed.join(", ")}].`
      );
    }
  }
}
