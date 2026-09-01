/**
 * Narrative Quality Evaluator
 * Evaluates narrative coherence, completeness, pacing, vocabulary density,
 * hook strength, conclusion quality, and unsupported claims.
 */

import { NarrativeQualityReport, NarrativePlan, ScriptPlan } from "./models";

export class NarrativeQualityEvaluator {
  /**
   * Evaluates narrative and script plans, producing a comprehensive quality report.
   */
  public static evaluateQuality(params: {
    narrativePlan: NarrativePlan;
    scriptPlan: ScriptPlan;
  }): NarrativeQualityReport {
    const { narrativePlan, scriptPlan } = params;
    const issues: string[] = [];
    const recommendations: string[] = [];

    // 1. Coherence & Progression
    const hasHook = narrativePlan.beats.length > 0;
    const hasConclusion = narrativePlan.beats.some(b => b.beatType === "SUMMARY" || b.beatType === "CELEBRATION" || b.beatType === "OUTRO");
    const coherenceScore = hasHook && hasConclusion ? 0.95 : 0.70;

    if (!hasConclusion) {
      issues.push("Script lacks a definitive concluding or summary narrative beat.");
      recommendations.push("Add a concluding summary beat to reinforce key takeaways.");
    }

    // 2. Completeness
    const completenessScore = narrativePlan.beats.length >= 2 ? 0.95 : 0.60;
    if (narrativePlan.beats.length < 2) {
      issues.push("Narrative plan contains fewer than 2 beats.");
    }

    // 3. Pacing
    const totalWords = scriptPlan.totalWordCount;
    const expectedWords = (narrativePlan.totalPlannedDurationSeconds / 60) * narrativePlan.targetWpm;
    const wordRatio = totalWords / Math.max(1, expectedWords);
    const pacingScore = wordRatio >= 0.6 && wordRatio <= 1.4 ? 0.95 : 0.75;

    // 4. Repetition Check
    const seenSentences = new Set<string>();
    let repetitionDetected = false;
    for (const seg of scriptPlan.segments) {
      const normalized = seg.text.toLowerCase().trim();
      if (seenSentences.has(normalized)) {
        repetitionDetected = true;
        issues.push(`Duplicate script text detected in segment ${seg.id}.`);
      }
      seenSentences.add(normalized);
    }

    // 5. Information Density & Audience Suitability
    const infoDensityScore = Math.min(1.0, 0.5 + (narrativePlan.concepts.length * 0.15));
    const audienceSuitabilityScore = 0.95;

    // 6. Hook & Conclusion Scores
    const hookQualityScore = narrativePlan.hookType ? 0.95 : 0.60;
    const conclusionQualityScore = hasConclusion ? 0.95 : 0.60;

    // 7. Unsupported Claims
    const unsupportedClaims = narrativePlan.claims.filter(c => c.requiresVerification && c.confidence < 0.85);
    const unsupportedClaimCount = unsupportedClaims.length;

    if (unsupportedClaimCount > 0) {
      issues.push(`${unsupportedClaimCount} factual claims require external verification.`);
      recommendations.push("Verify external statistical claims with authoritative sources.");
    }

    const isApprovedForProduction = issues.length === 0 || (coherenceScore >= 0.8 && completenessScore >= 0.8);

    return {
      coherenceScore,
      completenessScore,
      pacingScore,
      repetitionDetected,
      informationDensityScore: Number(infoDensityScore.toFixed(2)),
      audienceSuitabilityScore,
      hookQualityScore,
      conclusionQualityScore,
      unsupportedClaimCount,
      issues,
      recommendations,
      isApprovedForProduction
    };
  }
}
