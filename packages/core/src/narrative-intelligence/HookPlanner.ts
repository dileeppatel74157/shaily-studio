/**
 * Hook Intelligence Planner
 * Selects and formulates domain-aligned narrative hooks (Question, Surprising Fact,
 * Problem, Scenario, Character Action, Direct Statement) based on intent and audience.
 */

import { HookType, ContentIntent, AudienceProfile } from "./models";

export class HookPlanner {
  /**
   * Plans an engaging, audience-tailored narrative hook.
   */
  public static planHook(intent: ContentIntent, audience: AudienceProfile): { hookType: HookType; hookText: string } {
    const domain = intent.domain.toUpperCase();
    const subject = intent.primarySubject;

    if (domain === "KIDS" || intent.characterDriven) {
      return {
        hookType: "CHARACTER_ACTION",
        hookText: "Leo the little lion woke up early, curious to see why the sky was glowing with bright morning light."
      };
    }

    if (domain === "FINANCE") {
      if (audience.targetAudience === "BEGINNER" || audience.targetAudience === "CHILD") {
        return {
          hookType: "QUESTION",
          hookText: "Have you ever wondered why things cost more money today than they used to in the past?"
        };
      }
      return {
        hookType: "SURPRISING_FACT",
        hookText: "Inflation silently erodes purchasing power over time, compounding the true cost of everyday essentials."
      };
    }

    if (domain === "HISTORY") {
      return {
        hookType: "SURPRISING_FACT",
        hookText: "At its peak, the Roman Empire stretched across three continents, uniting over fifty million people."
      };
    }

    if (domain === "DOCUMENTARY") {
      return {
        hookType: "PROBLEM",
        hookText: "Our planet's oceans absorb over ninety percent of excess planetary heat, driving unprecedented global shifts."
      };
    }

    // GENERAL
    return {
      hookType: "DIRECT_STATEMENT",
      hookText: `Understanding how ${subject.replace(/^(create|explain|a\s|video\s|explaining\s)*/i, "").trim()} works begins with one fundamental principle.`
    };
  }
}
