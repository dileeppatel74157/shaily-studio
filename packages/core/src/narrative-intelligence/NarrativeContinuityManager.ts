/**
 * Narrative Continuity Manager
 * Tracks established concepts, terminology, recurring visual motifs,
 * and unresolved narrative questions across sequential script segments and scenes.
 */

import { NarrativeContinuity, ScriptSegment, NarrativePlan } from "./models";

export class NarrativeContinuityManager {
  /**
   * Initializes narrative continuity state from a NarrativePlan.
   */
  public static initializeContinuity(plan: NarrativePlan): NarrativeContinuity {
    const motifs = [`MOTIF_${plan.domain.toUpperCase()}`];
    return {
      establishedConcepts: plan.concepts.map(c => c.name),
      introducedTerminology: plan.concepts.map(c => c.name.toLowerCase()),
      unresolvedQuestions: plan.hookType === "QUESTION" ? [plan.beats[0]?.plannedNarrationText || ""] : [],
      recurringExamples: [],
      visualMotifs: motifs
    };
  }

  /**
   * Updates continuity state after processing a ScriptSegment.
   */
  public static updateContinuity(
    current: NarrativeContinuity,
    segment: ScriptSegment
  ): NarrativeContinuity {
    const updated = { ...current };

    // Register concepts from segment
    for (const c of segment.concepts) {
      if (!updated.establishedConcepts.includes(c)) {
        updated.establishedConcepts.push(c);
      }
    }

    // Register visual motifs from visual opportunities
    for (const vo of segment.visualOpportunities) {
      const motif = `OPP_${vo.type}`;
      if (!updated.visualMotifs.includes(motif)) {
        updated.visualMotifs.push(motif);
      }
    }

    // If this is a summary or conclusion segment, resolve questions
    if (segment.beatType === "SUMMARY" || segment.beatType === "CELEBRATION" || segment.beatType === "OUTRO") {
      updated.unresolvedQuestions = [];
    }

    return updated;
  }
}
