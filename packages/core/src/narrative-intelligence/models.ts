/**
 * Intelligent Script & Narrative Intelligence Domain Models
 * Domain-agnostic semantic narrative infrastructure for Shaily Studio Video OS.
 * Serves FINANCE, HISTORY, DOCUMENTARY, KIDS, GENERAL and future video workloads.
 */

import { ContentDomain } from "../visual-intelligence/models";

export type UserObjective =
  | "EXPLAIN"
  | "DOCUMENT"
  | "STORY"
  | "COMPARE"
  | "DEMONSTRATE"
  | "ANALYZE"
  | "ENTERTAIN"
  | "SUMMARIZE";

export type TargetAudienceTier =
  | "CHILD"
  | "TEEN"
  | "BEGINNER"
  | "GENERAL"
  | "INTERMEDIATE"
  | "EXPERT";

export type NarrativeStructureType =
  | "EXPLANATION"
  | "PROBLEM_SOLUTION"
  | "CAUSE_EFFECT"
  | "TIMELINE"
  | "COMPARISON"
  | "QUESTION_ANSWER"
  | "DOCUMENTARY"
  | "STORY"
  | "CHARACTER_JOURNEY"
  | "LIST"
  | "CASE_STUDY"
  | "CONCEPT_TO_EXAMPLE"
  | "HOOK_EXPLANATION_SUMMARY";

export type HookType =
  | "QUESTION"
  | "SURPRISING_FACT"
  | "PROBLEM"
  | "CONTRAST"
  | "PROMISE"
  | "SCENARIO"
  | "CHARACTER_ACTION"
  | "DIRECT_STATEMENT";

export type VisualOpportunityType =
  | "NUMBER_COUNTER"
  | "LINE_CHART"
  | "BAR_CHART"
  | "AREA_CHART"
  | "DONUT_CHART"
  | "TIMELINE"
  | "MAP"
  | "STAT_CARD"
  | "INFO_CARD"
  | "CALLOUT"
  | "IMAGE"
  | "ARCHIVAL"
  | "CHARACTER"
  | "DIAGRAM"
  | "TEXT"
  | "LOWER_THIRD";

export interface ContentIntent {
  primarySubject: string;
  domain: ContentDomain;
  userObjective: UserObjective;
  targetAudience: TargetAudienceTier;
  requestedDurationSeconds: number;
  educationalLevel: "INTRODUCTORY" | "INTERMEDIATE" | "ADVANCED";
  emotionalTone: "ENTHUSIASTIC" | "AUTHORITATIVE" | "PLAYFUL" | "CALM" | "DRAMATIC" | "NEUTRAL";
  visualExplanationRequired: boolean;
  examplesRequired: boolean;
  chronologicalRequired: boolean;
  characterDriven: boolean;
  mapRequired: boolean;
}

export interface AudienceProfile {
  targetAudience: TargetAudienceTier;
  vocabularyComplexity: "SIMPLE" | "MODERATE" | "ADVANCED";
  sentenceComplexity: "SHORT_DIRECT" | "BALANCED" | "COMPOUND_TECHNICAL";
  explanationDepth: "SURFACE_INTUITIVE" | "CONCEPTUAL_CLEAR" | "RIGOROUS_DETAILED";
  assumedPriorKnowledge: "NONE" | "BASIC" | "DOMAIN_PROFICIENT";
  terminologyStrategy: "AVOID" | "DEFINE_FIRST" | "USE_FREELY";
  narrationSpeedWpm: number;
  exampleFrequency: "HIGH" | "MODERATE" | "LOW";
}

export interface Claim {
  claimId: string;
  statement: string;
  importance: "CORE" | "SUPPORTING" | "CONTEXTUAL";
  confidence: number; // 0.0 to 1.0
  requiresVerification: boolean; // True if external fact checking needed, never faked
  supportingContext?: string;
  visualizable: boolean;
  relatedConcepts: string[];
}

export interface Concept {
  conceptId: string;
  name: string;
  definition: string;
  prerequisiteConcepts: string[];
  complexityLevel: "BASIC" | "INTERMEDIATE" | "ADVANCED";
}

export interface ExampleIllustration {
  exampleId: string;
  conceptId: string;
  description: string;
  visualOpportunity?: VisualOpportunityType;
}

export interface VisualOpportunity {
  id: string;
  type: VisualOpportunityType;
  description: string;
  suggestedStartTimeSeconds: number;
  suggestedDurationSeconds: number;
  targetConceptId?: string;
}

export interface NarrativeBeat {
  id: string;
  beatIndex: number;
  beatType: string;
  targetDurationSeconds: number;
  purpose: string;
  coreConcept?: string;
  claims: Claim[];
  examples: ExampleIllustration[];
  visualOpportunities: VisualOpportunity[];
  plannedNarrationText: string;
}

export interface ScriptSegment {
  id: string;
  segmentIndex: number;
  text: string;
  purpose: string;
  beatType: string;
  estimatedDurationSeconds: number;
  targetWords: number;
  emphasisWords: string[];
  concepts: string[];
  claims: Claim[];
  visualOpportunities: VisualOpportunity[];
  narrationInstructions: {
    emotion: string;
    speakingRate: number; // 0.8 to 1.3
    pauseAfterSeconds: number;
  };
}

export interface NarrativePlan {
  id: string;
  subject: string;
  domain: ContentDomain;
  intent: ContentIntent;
  audience: AudienceProfile;
  structure: NarrativeStructureType;
  hookType: HookType;
  beats: NarrativeBeat[];
  concepts: Concept[];
  claims: Claim[];
  totalPlannedDurationSeconds: number;
  targetWpm: number;
}

export interface ScriptPlan {
  id: string;
  narrativePlanId: string;
  segments: ScriptSegment[];
  fullScriptText: string;
  totalWordCount: number;
  totalEstimatedDurationSeconds: number;
}

export interface NarrativeContinuity {
  establishedConcepts: string[];
  introducedTerminology: string[];
  unresolvedQuestions: string[];
  recurringExamples: string[];
  visualMotifs: string[];
}

export interface NarrativeQualityReport {
  coherenceScore: number; // 0.0 to 1.0
  completenessScore: number; // 0.0 to 1.0
  pacingScore: number; // 0.0 to 1.0
  repetitionDetected: boolean;
  informationDensityScore: number; // 0.0 to 1.0
  audienceSuitabilityScore: number; // 0.0 to 1.0
  hookQualityScore: number; // 0.0 to 1.0
  conclusionQualityScore: number; // 0.0 to 1.0
  unsupportedClaimCount: number;
  issues: string[];
  recommendations: string[];
  isApprovedForProduction: boolean;
}
