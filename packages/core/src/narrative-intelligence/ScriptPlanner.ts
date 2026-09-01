/**
 * Script Planner & Segment Compiler
 * Transforms a NarrativePlan into a deterministic, timing-calibrated ScriptPlan
 * with emphasis words, claims, visual opportunities, and narration instructions.
 */

import { ScriptPlan, ScriptSegment, NarrativePlan } from "./models";

export class ScriptPlanner {
  /**
   * Compiles a NarrativePlan into a concrete ScriptPlan.
   */
  public static planScript(narrativePlan: NarrativePlan): ScriptPlan {
    const segments: ScriptSegment[] = [];
    const fullScriptParagraphs: string[] = [];
    let totalWordCount = 0;
    let totalEstimatedDurationSeconds = 0;

    for (let i = 0; i < narrativePlan.beats.length; i++) {
      const beat = narrativePlan.beats[i];
      const text = beat.plannedNarrationText;
      const words = text.split(/\s+/).filter(w => w.length > 0);
      const wordCount = words.length;

      // Extract emphasis words (longer impactful words)
      const emphasisWords = words
        .map(w => w.replace(/[^a-zA-Z]/g, ""))
        .filter(w => w.length >= 6)
        .slice(0, 3);

      const targetWords = Math.round((beat.targetDurationSeconds / 60) * narrativePlan.targetWpm);

      const segment: ScriptSegment = {
        id: `seg-${i + 1}`,
        segmentIndex: i + 1,
        text,
        purpose: beat.purpose,
        beatType: beat.beatType,
        estimatedDurationSeconds: beat.targetDurationSeconds,
        targetWords: Math.max(wordCount, targetWords),
        emphasisWords,
        concepts: beat.coreConcept ? [beat.coreConcept] : [],
        claims: beat.claims,
        visualOpportunities: beat.visualOpportunities,
        narrationInstructions: {
          emotion: narrativePlan.intent.emotionalTone.toLowerCase(),
          speakingRate: Number((narrativePlan.targetWpm / 140).toFixed(2)),
          pauseAfterSeconds: i === narrativePlan.beats.length - 1 ? 0.5 : 0.2
        }
      };

      segments.push(segment);
      fullScriptParagraphs.push(text);
      totalWordCount += wordCount;
      totalEstimatedDurationSeconds += beat.targetDurationSeconds;
    }

    return {
      id: `sp-${narrativePlan.id}`,
      narrativePlanId: narrativePlan.id,
      segments,
      fullScriptText: fullScriptParagraphs.join("\n\n"),
      totalWordCount,
      totalEstimatedDurationSeconds: Number(totalEstimatedDurationSeconds.toFixed(2))
    };
  }
}
