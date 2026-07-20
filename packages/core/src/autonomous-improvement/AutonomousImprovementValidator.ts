import {
  ImprovementRecommendation,
  OptimizationDecision,
  Experiment,
  LearningDataset,
  ABTest,
  ImprovementValidationReport,
  ImprovementValidationIssue
} from "./models";
import { ValidationException } from "./types";
import { ExperimentState } from "./ExperimentState";

export class AutonomousImprovementValidator {
  public static validate(
    decision: OptimizationDecision,
    recs: ImprovementRecommendation[]
  ): ImprovementValidationReport {
    const issues: ImprovementValidationIssue[] = [];

    // 1. Decision ID required
    if (!decision.id || decision.id.trim() === "") {
      issues.push({ field: "id", message: "Decision ID is required.", severity: "CRITICAL" });
    }

    // 2. Recommendation target exists
    const rec = recs.find(r => r.id === decision.recommendationId);
    if (!rec) {
      issues.push({ field: "recommendationId", message: `Recommendation target ${decision.recommendationId} does not exist.`, severity: "CRITICAL" });
    } else {
      // 3. Confidence score between 0 and 100
      if (rec.confidence.scorePercent < 0 || rec.confidence.scorePercent > 100) {
        issues.push({ field: "confidence.scorePercent", message: "Confidence score must be between 0 and 100.", severity: "CRITICAL" });
      }
    }

    // 4. Optimization score valid (quality delta >= -100%)
    if (decision.qualityDeltaPercent < -100) {
      issues.push({ field: "qualityDeltaPercent", message: "Quality delta cannot be less than -100%.", severity: "CRITICAL" });
    }

    const valid = !issues.some(i => i.severity === "CRITICAL");
    return {
      valid,
      issues,
      timestamp: new Date()
    };
  }

  public static assertValid(decision: OptimizationDecision, recs: ImprovementRecommendation[]): void {
    const report = this.validate(decision, recs);
    if (!report.valid) {
      const crit = report.issues.find(i => i.severity === "CRITICAL");
      throw new ValidationException(`Validation failed: ${crit?.message}`);
    }
  }

  // Extra validator rules
  public static validateExperiment(exp: Experiment): void {
    // 5. Experiment duration > 0
    if (exp.durationDays <= 0) {
      throw new ValidationException("Experiment duration must be positive.");
    }
    // 6. Winner selected when completed
    if (exp.state === ExperimentState.COMPLETED && !exp.winnerVariant) {
      throw new ValidationException("Winner variant must be selected for completed experiments.");
    }
    // 7. Improvement percentage >= -100
    if (exp.improvementPercent < -100) {
      throw new ValidationException("Experiment improvement percentage must be >= -100%.");
    }
  }

  public static validateDataset(dataset: LearningDataset): void {
    // 8. Dataset not empty
    if (!dataset.samples || dataset.samples.length === 0 || dataset.size <= 0) {
      throw new ValidationException("Dataset must contain learning samples.");
    }
  }

  public static validateABTest(test: ABTest): void {
    // 9. Variant count >= 2
    if (!test.variants || test.variants.length < 2) {
      throw new ValidationException("A/B test must have at least 2 variants.");
    }
  }

  public static validateLearningSample(sample: any): void {
    // 10. Learning sample valid (must have non-empty features and labels)
    if (!sample.inputFeatures || Object.keys(sample.inputFeatures).length === 0) {
      throw new ValidationException("Learning sample must have input features.");
    }
    if (!sample.observedLabels || Object.keys(sample.observedLabels).length === 0) {
      throw new ValidationException("Learning sample must have observed labels.");
    }
  }

  public static validateNoDuplicateExperiments(experiments: Experiment[]): void {
    // 11. No duplicate experiments
    const ids = new Set<string>();
    for (const e of experiments) {
      if (ids.has(e.id)) {
        throw new ValidationException("Duplicate experiments detected.");
      }
      ids.add(e.id);
    }
  }

  public static validateFeedbackLoop(loop: any): void {
    // 12. Feedback loop connected
    if (!loop.sourceEngine || !loop.destEngine) {
      throw new ValidationException("Feedback loop must have both source and destination engines defined.");
    }
  }

  public static validatePacing(wpm: number): void {
    // 13. Pacing positive
    if (wpm <= 0) throw new ValidationException("Pacing words per minute must be positive.");
  }

  public static validateGrowthVelocity(vel: number): void {
    // 14. Growth velocity positive
    if (vel < 0) throw new ValidationException("Growth velocity cannot be negative.");
  }

  public static validateSuccessRate(rate: number): void {
    // 15. Success rate valid
    if (rate < 0 || rate > 100) throw new ValidationException("Success rate must be between 0 and 100.");
  }

  public static validateFailureAction(action: string): void {
    // 16. Rollback action present
    if (!action || action.trim() === "") {
      throw new ValidationException("Failure analysis must contain a valid rollback action.");
    }
  }

  public static validateBudgetSavings(saving: number): void {
    // 17. Budget savings positive
    if (saving < 0) throw new ValidationException("Estimated savings cannot be negative.");
  }

  public static validateRecommendationId(id: string): void {
    // 18. Recommendation ID required
    if (!id || id.trim() === "") throw new ValidationException("Recommendation ID is required.");
  }

  public static validateConfidenceThreshold(score: number, level: string): void {
    // 19. Confidence level matches score thresholds
    if (level === "HIGH" && score < 75) {
      throw new ValidationException("Confidence level HIGH requires score >= 75%.");
    }
  }

  public static validateNetGained(net: number, total: number): void {
    // 20. Net follows count limits
    if (total + net < 0) {
      throw new ValidationException("Total followers count cannot fall below zero.");
    }
  }
}
