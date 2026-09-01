/**
 * Narrative Structure Planner
 * Formulates structured, duration-aware NarrativePlans containing narrative beats,
 * core concepts, factual claims with verification flags, and visual opportunities.
 */

import {
  NarrativePlan,
  NarrativeBeat,
  NarrativeStructureType,
  ContentIntent,
  AudienceProfile,
  Concept,
  Claim,
  ExampleIllustration,
  VisualOpportunity
} from "./models";
import { HookPlanner } from "./HookPlanner";

export class NarrativePlanner {
  /**
   * Plans a comprehensive NarrativePlan from intent and audience profile.
   */
  public static planNarrative(intent: ContentIntent, audience: AudienceProfile): NarrativePlan {
    const domain = intent.domain.toUpperCase();
    const duration = intent.requestedDurationSeconds;

    // 1. Select Narrative Structure
    let structure: NarrativeStructureType = "EXPLANATION";
    if (domain === "KIDS" || intent.characterDriven) {
      structure = "STORY";
    } else if (domain === "HISTORY" || intent.chronologicalRequired) {
      structure = "TIMELINE";
    } else if (domain === "DOCUMENTARY") {
      structure = "CAUSE_EFFECT";
    } else if (domain === "FINANCE") {
      structure = "CONCEPT_TO_EXAMPLE";
    } else {
      structure = "HOOK_EXPLANATION_SUMMARY";
    }

    // 2. Select Hook
    const hook = HookPlanner.planHook(intent, audience);

    // 3. Formulate Domain Concepts, Claims & Examples
    const { concepts, claims, examples } = this.formulateConceptsAndClaims(intent, audience);

    // 4. Calculate Beat Counts & Durations
    const numBeats = this.calculateBeatCount(duration);
    const beatDuration = Number((duration / numBeats).toFixed(2));

    // 5. Generate Narrative Beats
    const beats = this.assembleNarrativeBeats({
      intent,
      audience,
      structure,
      hook,
      numBeats,
      beatDuration,
      concepts,
      claims,
      examples
    });

    return {
      id: `np-${intent.domain.toLowerCase()}-${duration}s`,
      subject: intent.primarySubject,
      domain: intent.domain,
      intent,
      audience,
      structure,
      hookType: hook.hookType,
      beats,
      concepts,
      claims,
      totalPlannedDurationSeconds: duration,
      targetWpm: audience.narrationSpeedWpm
    };
  }

  /**
   * Calculates optimal narrative beat count based on duration.
   */
  private static calculateBeatCount(durationSeconds: number): number {
    if (durationSeconds <= 15) return 2;
    if (durationSeconds <= 25) return 3;
    if (durationSeconds <= 45) return 4;
    if (durationSeconds <= 90) return 5;
    if (durationSeconds <= 180) return 6;
    return 8;
  }

  /**
   * Formulates domain-specific concepts, claims with requiresVerification flags, and examples.
   */
  private static formulateConceptsAndClaims(intent: ContentIntent, audience: AudienceProfile): {
    concepts: Concept[];
    claims: Claim[];
    examples: ExampleIllustration[];
  } {
    const domain = intent.domain.toUpperCase();

    if (domain === "FINANCE") {
      const concepts: Concept[] = [
        { conceptId: "c-inflation", name: "Inflation", definition: "The general increase in prices and fall in the purchasing power of money over time.", prerequisiteConcepts: [], complexityLevel: "BASIC" },
        { conceptId: "c-purchasing-power", name: "Purchasing Power", definition: "The financial ability to buy goods and services.", prerequisiteConcepts: ["c-inflation"], complexityLevel: "BASIC" }
      ];
      const claims: Claim[] = [
        { claimId: "cl-fin-1", statement: "Over time, inflation decreases the quantity of goods a fixed amount of currency can purchase.", importance: "CORE", confidence: 0.95, requiresVerification: true, visualizable: true, relatedConcepts: ["c-inflation", "c-purchasing-power"] },
        { claimId: "cl-fin-2", statement: "A modest inflation rate of 2% is commonly targeted by central banks to maintain economic stability.", importance: "SUPPORTING", confidence: 0.90, requiresVerification: true, visualizable: true, relatedConcepts: ["c-inflation"] }
      ];
      const examples: ExampleIllustration[] = [
        { exampleId: "ex-fin-1", conceptId: "c-inflation", description: "A basket of groceries costing $100 today requiring $120 five years later.", visualOpportunity: "STAT_CARD" }
      ];
      return { concepts, claims, examples };
    }

    if (domain === "HISTORY") {
      const concepts: Concept[] = [
        { conceptId: "c-expansion", name: "Territorial Expansion", definition: "The systematic growth of a state's borders through military conquest and diplomacy.", prerequisiteConcepts: [], complexityLevel: "BASIC" },
        { conceptId: "c-infrastructure", name: "Imperial Infrastructure", definition: "The network of roads, forts, and administration supporting an empire.", prerequisiteConcepts: ["c-expansion"], complexityLevel: "INTERMEDIATE" }
      ];
      const claims: Claim[] = [
        { claimId: "cl-hist-1", statement: "The Roman Empire expanded from the Italian peninsula across the Mediterranean basin through legionary discipline and engineering.", importance: "CORE", confidence: 0.95, requiresVerification: true, visualizable: true, relatedConcepts: ["c-expansion"] }
      ];
      const examples: ExampleIllustration[] = [
        { exampleId: "ex-hist-1", conceptId: "c-expansion", description: "The expansion of Roman road networks across Gaul and Britannia.", visualOpportunity: "MAP" }
      ];
      return { concepts, claims, examples };
    }

    if (domain === "DOCUMENTARY") {
      const concepts: Concept[] = [
        { conceptId: "c-heat-absorption", name: "Ocean Thermal Capacity", definition: "The physical capacity of oceans to store atmospheric heat.", prerequisiteConcepts: [], complexityLevel: "BASIC" }
      ];
      const claims: Claim[] = [
        { claimId: "cl-doc-1", statement: "Oceans absorb over 90% of excess heat trapped by greenhouse gases in Earth's atmosphere.", importance: "CORE", confidence: 0.95, requiresVerification: true, visualizable: true, relatedConcepts: ["c-heat-absorption"] }
      ];
      const examples: ExampleIllustration[] = [
        { exampleId: "ex-doc-1", conceptId: "c-heat-absorption", description: "Thermal mapping showing elevated sea surface temperatures.", visualOpportunity: "LINE_CHART" }
      ];
      return { concepts, claims, examples };
    }

    if (domain === "KIDS") {
      const concepts: Concept[] = [
        { conceptId: "c-earth-rotation", name: "Earth's Rotation", definition: "The spinning of planet Earth causing day and night.", prerequisiteConcepts: [], complexityLevel: "BASIC" }
      ];
      const claims: Claim[] = [
        { claimId: "cl-kids-1", statement: "The sun appears to rise each morning because the Earth is gently spinning like a carousel.", importance: "CORE", confidence: 0.99, requiresVerification: false, visualizable: true, relatedConcepts: ["c-earth-rotation"] }
      ];
      const examples: ExampleIllustration[] = [
        { exampleId: "ex-kids-1", conceptId: "c-earth-rotation", description: "Leo turning around to see the sun appear on the horizon.", visualOpportunity: "CHARACTER" }
      ];
      return { concepts, claims, examples };
    }

    // GENERAL
    const concepts: Concept[] = [
      { conceptId: "c-core", name: "Core Principle", definition: "The fundamental mechanism governing the topic.", prerequisiteConcepts: [], complexityLevel: "BASIC" }
    ];
    const claims: Claim[] = [
      { claimId: "cl-gen-1", statement: "The phenomenon occurs due to predictable interactions between key elements.", importance: "CORE", confidence: 0.90, requiresVerification: true, visualizable: true, relatedConcepts: ["c-core"] }
    ];
    const examples: ExampleIllustration[] = [
      { exampleId: "ex-gen-1", conceptId: "c-core", description: "Direct visual demonstration of the principle.", visualOpportunity: "INFO_CARD" }
    ];
    return { concepts, claims, examples };
  }

  /**
   * Assembles the list of NarrativeBeats for the plan.
   */
  private static assembleNarrativeBeats(params: {
    intent: ContentIntent;
    audience: AudienceProfile;
    structure: NarrativeStructureType;
    hook: { hookType: string; hookText: string };
    numBeats: number;
    beatDuration: number;
    concepts: Concept[];
    claims: Claim[];
    examples: ExampleIllustration[];
  }): NarrativeBeat[] {
    const { intent, audience, hook, numBeats, beatDuration, concepts, claims, examples } = params;
    const domain = intent.domain.toUpperCase();
    const beats: NarrativeBeat[] = [];

    const beatTemplates: Record<string, Array<{ type: string; purpose: string; visualType: VisualOpportunity["type"] }>> = {
      FINANCE: [
        { type: "HOOK", purpose: "Engage with real-world financial curiosity", visualType: "STAT_CARD" },
        { type: "CORE_EXPLANATION", purpose: "Define core financial mechanism", visualType: "LINE_CHART" },
        { type: "EXAMPLE", purpose: "Demonstrate impact with numerical counter", visualType: "NUMBER_COUNTER" },
        { type: "SUMMARY", purpose: "Deliver actionable key takeaway", visualType: "INFO_CARD" }
      ],
      HISTORY: [
        { type: "HOOK", purpose: "Introduce historical era and milestone", visualType: "MAP" },
        { type: "CHRONOLOGY", purpose: "Detail territorial expansion and campaign", visualType: "TIMELINE" },
        { type: "IMPACT", purpose: "Illustrate lasting historical consequences", visualType: "INFO_CARD" },
        { type: "SUMMARY", purpose: "Summarize imperial legacy", visualType: "CALLOUT" }
      ],
      DOCUMENTARY: [
        { type: "HOOK", purpose: "Highlight environmental challenge", visualType: "IMAGE" },
        { type: "EVIDENCE", purpose: "Present scientific thermal data", visualType: "LINE_CHART" },
        { type: "CONSEQUENCE", purpose: "Show ecosystem impact", visualType: "CALLOUT" },
        { type: "SUMMARY", purpose: "Deliver planetary conclusion", visualType: "LOWER_THIRD" }
      ],
      KIDS: [
        { type: "HOOK", purpose: "Introduce playful character setting", visualType: "CHARACTER" },
        { type: "DISCOVERY", purpose: "Character explores natural curiosity", visualType: "CHARACTER" },
        { type: "EXPLANATION", purpose: "Friendly intuitive visual reveal", visualType: "INFO_CARD" },
        { type: "CELEBRATION", purpose: "Playful cheerful conclusion", visualType: "CHARACTER" }
      ],
      GENERAL: [
        { type: "HOOK", purpose: "Capture attention with core question", visualType: "INFO_CARD" },
        { type: "EXPLANATION", purpose: "Explain step-by-step mechanism", visualType: "DIAGRAM" },
        { type: "APPLICATION", purpose: "Show real-world example", visualType: "STAT_CARD" },
        { type: "SUMMARY", purpose: "Summarize essential understanding", visualType: "LOWER_THIRD" }
      ]
    };

    const templates = beatTemplates[domain] || beatTemplates.GENERAL;

    const totalDuration = intent.requestedDurationSeconds;
    for (let i = 0; i < numBeats; i++) {
      const template = i === numBeats - 1 ? templates[templates.length - 1] : templates[i % (templates.length - 1)];
      const startSec = Number((i * beatDuration).toFixed(2));
      const curDuration = i === numBeats - 1 ? Number((totalDuration - (beatDuration * (numBeats - 1))).toFixed(2)) : beatDuration;



      const visualOpp: VisualOpportunity = {
        id: `vo-${i + 1}`,
        type: template.visualType,
        description: `Visual element supporting ${template.purpose}`,
        suggestedStartTimeSeconds: startSec,
        suggestedDurationSeconds: curDuration,
        targetConceptId: concepts[0]?.conceptId
      };

      let narrationText = "";
      if (i === 0) {
        narrationText = hook.hookText;
      } else if (i === numBeats - 1) {
        narrationText = `In summary, understanding ${intent.primarySubject.replace(/^(create|explain|a\s|video\s|explaining\s)*/i, "").trim()} helps us make sense of the world around us.`;
      } else {
        narrationText = claims[0]?.statement || `This is how ${intent.primarySubject} works step by step.`;
      }

      beats.push({
        id: `beat-${i + 1}`,
        beatIndex: i + 1,
        beatType: template.type,
        targetDurationSeconds: curDuration,
        purpose: template.purpose,
        coreConcept: concepts[0]?.conceptId,
        claims: claims.slice(0, 1),
        examples: examples.slice(0, 1),
        visualOpportunities: [visualOpp],
        plannedNarrationText: narrationText
      });
    }


    return beats;
  }
}
