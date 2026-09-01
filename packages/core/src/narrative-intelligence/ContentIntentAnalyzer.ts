/**
 * Content Intent Analyzer
 * Analyzes user prompt and context to extract core subject, intent, domain,
 * audience tier, duration, and semantic production requirements.
 */

import { ContentIntent, UserObjective, TargetAudienceTier } from "./models";
import { ContentDomain } from "../visual-intelligence/models";

export class ContentIntentAnalyzer {
  /**
   * Analyzes an arbitrary user prompt into a structured ContentIntent.
   */
  public static analyzePrompt(prompt: string, overrideDurationSeconds?: number): ContentIntent {
    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      throw new Error("Cannot analyze empty prompt: prompt text is required.");
    }

    const trimmed = prompt.trim();
    if (trimmed.length > 5000) {
      throw new Error("Prompt exceeds maximum supported length of 5000 characters.");
    }

    const lower = trimmed.toLowerCase();

    // 1. Duration Extraction
    let requestedDurationSeconds = overrideDurationSeconds || 20;
    const secMatch = lower.match(/(\d+)\s*(?:second|sec|s\b)/);
    const minMatch = lower.match(/(\d+)\s*(?:minute|min|m\b)/);

    if (minMatch) {
      requestedDurationSeconds = parseInt(minMatch[1], 10) * 60;
    } else if (secMatch) {
      requestedDurationSeconds = parseInt(secMatch[1], 10);
    }

    if (requestedDurationSeconds < 5 || requestedDurationSeconds > 3600) {
      throw new Error(`Requested duration of ${requestedDurationSeconds}s is out of supported range (5s to 3600s).`);
    }

    // 2. Domain & Subject Extraction
    let domain: ContentDomain = "GENERAL";
    let primarySubject = trimmed;

    if (lower.includes("inflation") || lower.includes("stock") || lower.includes("finance") || lower.includes("money") || lower.includes("crypto") || lower.includes("revenue") || lower.includes("economy") || lower.includes("invest")) {
      domain = "FINANCE";
    } else if (lower.includes("roman") || lower.includes("history") || lower.includes("empire") || lower.includes("century") || lower.includes("war") || lower.includes("ancient") || lower.includes("dynasty") || lower.includes("rebellion")) {
      domain = "HISTORY";
    } else if (lower.includes("ocean") || lower.includes("documentary") || lower.includes("climate") || lower.includes("planet") || lower.includes("nature") || lower.includes("species") || lower.includes("ecosystem") || lower.includes("environment")) {
      domain = "DOCUMENTARY";
    } else if (lower.includes("leo") || lower.includes("kid") || lower.includes("children") || lower.includes("cartoon") || lower.includes("lion") || lower.includes("adventure") || lower.includes("fairy") || lower.includes("playful")) {
      domain = "KIDS";
    }

    // 3. User Objective
    let userObjective: UserObjective = "EXPLAIN";
    if (lower.includes("documentary") || lower.includes("document")) {
      userObjective = "DOCUMENT";
    } else if (lower.includes("story") || lower.includes("tale") || lower.includes("adventure")) {
      userObjective = "STORY";
    } else if (lower.includes("compare") || lower.includes("versus") || lower.includes("vs")) {
      userObjective = "COMPARE";
    } else if (lower.includes("summarize") || lower.includes("summary")) {
      userObjective = "SUMMARIZE";
    } else if (lower.includes("analyze") || lower.includes("breakdown")) {
      userObjective = "ANALYZE";
    }

    // 4. Target Audience
    let targetAudience: TargetAudienceTier = "GENERAL";
    if (lower.includes("for kids") || lower.includes("for children") || lower.includes("child") || domain === "KIDS") {
      targetAudience = "CHILD";
    } else if (lower.includes("for beginner") || lower.includes("beginners") || lower.includes("introductory") || lower.includes("basics")) {
      targetAudience = "BEGINNER";
    } else if (lower.includes("expert") || lower.includes("advanced") || lower.includes("professional") || lower.includes("in-depth")) {
      targetAudience = "EXPERT";
    } else if (lower.includes("intermediate")) {
      targetAudience = "INTERMEDIATE";
    } else if (lower.includes("teen") || lower.includes("students")) {
      targetAudience = "TEEN";
    }


    // 5. Requirements Determination
    const chronologicalRequired = domain === "HISTORY" || lower.includes("timeline") || lower.includes("expanded") || lower.includes("evolution");
    const mapRequired = domain === "HISTORY" || lower.includes("map") || lower.includes("geography") || lower.includes("expanded");
    const characterDriven = domain === "KIDS" || userObjective === "STORY" || lower.includes("leo");
    const visualExplanationRequired = domain === "FINANCE" || domain === "DOCUMENTARY" || lower.includes("explain") || lower.includes("how");
    const examplesRequired = targetAudience === "BEGINNER" || targetAudience === "CHILD" || domain === "FINANCE";

    let educationalLevel: ContentIntent["educationalLevel"] = "INTRODUCTORY";
    if (targetAudience === "EXPERT") educationalLevel = "ADVANCED";
    else if (targetAudience === "INTERMEDIATE") educationalLevel = "INTERMEDIATE";

    let emotionalTone: ContentIntent["emotionalTone"] = "NEUTRAL";
    if (domain === "KIDS") emotionalTone = "PLAYFUL";
    else if (domain === "FINANCE") emotionalTone = "AUTHORITATIVE";
    else if (domain === "DOCUMENTARY") emotionalTone = "CALM";
    else if (domain === "HISTORY") emotionalTone = "DRAMATIC";

    return {
      primarySubject,
      domain,
      userObjective,
      targetAudience,
      requestedDurationSeconds,
      educationalLevel,
      emotionalTone,
      visualExplanationRequired,
      examplesRequired,
      chronologicalRequired,
      characterDriven,
      mapRequired
    };
  }
}
