/**
 * Audience Intelligence Analyzer
 * Derives comprehensive audience profiles tailoring vocabulary complexity,
 * sentence structure, explanation depth, speaking rates, and example frequencies.
 */

import { AudienceProfile, TargetAudienceTier } from "./models";

export class AudienceAnalyzer {
  /**
   * Resolves detailed audience profile from target audience tier.
   */
  public static resolveAudienceProfile(tier: TargetAudienceTier): AudienceProfile {
    switch (tier) {
      case "CHILD":
        return {
          targetAudience: "CHILD",
          vocabularyComplexity: "SIMPLE",
          sentenceComplexity: "SHORT_DIRECT",
          explanationDepth: "SURFACE_INTUITIVE",
          assumedPriorKnowledge: "NONE",
          terminologyStrategy: "AVOID",
          narrationSpeedWpm: 125,
          exampleFrequency: "HIGH"
        };

      case "BEGINNER":
        return {
          targetAudience: "BEGINNER",
          vocabularyComplexity: "SIMPLE",
          sentenceComplexity: "SHORT_DIRECT",
          explanationDepth: "CONCEPTUAL_CLEAR",
          assumedPriorKnowledge: "NONE",
          terminologyStrategy: "DEFINE_FIRST",
          narrationSpeedWpm: 130,
          exampleFrequency: "HIGH"
        };

      case "TEEN":
        return {
          targetAudience: "TEEN",
          vocabularyComplexity: "MODERATE",
          sentenceComplexity: "BALANCED",
          explanationDepth: "CONCEPTUAL_CLEAR",
          assumedPriorKnowledge: "BASIC",
          terminologyStrategy: "DEFINE_FIRST",
          narrationSpeedWpm: 140,
          exampleFrequency: "HIGH"
        };

      case "INTERMEDIATE":
        return {
          targetAudience: "INTERMEDIATE",
          vocabularyComplexity: "MODERATE",
          sentenceComplexity: "BALANCED",
          explanationDepth: "RIGOROUS_DETAILED",
          assumedPriorKnowledge: "BASIC",
          terminologyStrategy: "USE_FREELY",
          narrationSpeedWpm: 150,
          exampleFrequency: "MODERATE"
        };

      case "EXPERT":
        return {
          targetAudience: "EXPERT",
          vocabularyComplexity: "ADVANCED",
          sentenceComplexity: "COMPOUND_TECHNICAL",
          explanationDepth: "RIGOROUS_DETAILED",
          assumedPriorKnowledge: "DOMAIN_PROFICIENT",
          terminologyStrategy: "USE_FREELY",
          narrationSpeedWpm: 160,
          exampleFrequency: "LOW"
        };

      case "GENERAL":
      default:
        return {
          targetAudience: "GENERAL",
          vocabularyComplexity: "MODERATE",
          sentenceComplexity: "BALANCED",
          explanationDepth: "CONCEPTUAL_CLEAR",
          assumedPriorKnowledge: "BASIC",
          terminologyStrategy: "DEFINE_FIRST",
          narrationSpeedWpm: 140,
          exampleFrequency: "MODERATE"
        };
    }
  }
}
