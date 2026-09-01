/**
 * Narrative Intelligence Engine
 * Central orchestrator transforming raw user video prompts into coherent,
 * audience-aware, production-ready NarrativePlans and ScriptPlans.
 */

import {
  ContentIntent,
  AudienceProfile,
  NarrativePlan,
  ScriptPlan,
  NarrativeContinuity,
  NarrativeQualityReport
} from "./models";
import { ContentIntentAnalyzer } from "./ContentIntentAnalyzer";
import { AudienceAnalyzer } from "./AudienceAnalyzer";
import { NarrativePlanner } from "./NarrativePlanner";
import { ScriptPlanner } from "./ScriptPlanner";
import { NarrativeContinuityManager } from "./NarrativeContinuityManager";
import { NarrativeQualityEvaluator } from "./NarrativeQualityEvaluator";
import { InformationProgressionEngine } from "./InformationProgressionEngine";

export interface NarrativeGenerationResult {
  intent: ContentIntent;
  audience: AudienceProfile;
  narrativePlan: NarrativePlan;
  scriptPlan: ScriptPlan;
  continuity: NarrativeContinuity;
  qualityReport: NarrativeQualityReport;
}

export class NarrativeIntelligenceEngine {
  /**
   * Generates a complete, structured narrative package from an arbitrary user video prompt.
   */
  public static generateNarrative(
    prompt: string,
    overrideDurationSeconds?: number
  ): NarrativeGenerationResult {
    // 1. Content Intent Analysis
    const intent = ContentIntentAnalyzer.analyzePrompt(prompt, overrideDurationSeconds);

    // 2. Audience Intelligence
    const audience = AudienceAnalyzer.resolveAudienceProfile(intent.targetAudience);

    // 3. Narrative Plan Formulation
    const narrativePlan = NarrativePlanner.planNarrative(intent, audience);

    // 4. Information Progression Validation
    InformationProgressionEngine.validateAndOrderProgression({
      concepts: narrativePlan.concepts,
      claims: narrativePlan.claims,
      examples: narrativePlan.beats.flatMap(b => b.examples)
    });

    // 5. Script Planning
    const scriptPlan = ScriptPlanner.planScript(narrativePlan);

    // 6. Narrative Continuity Initialization
    const continuity = NarrativeContinuityManager.initializeContinuity(narrativePlan);

    // 7. Quality & QA Evaluation
    const qualityReport = NarrativeQualityEvaluator.evaluateQuality({
      narrativePlan,
      scriptPlan
    });

    return {
      intent,
      audience,
      narrativePlan,
      scriptPlan,
      continuity,
      qualityReport
    };
  }
}
