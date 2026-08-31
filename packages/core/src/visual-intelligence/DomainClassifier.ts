/**
 * Domain Classifier
 * Deterministically and intelligently categorizes user topic prompts into production domains:
 * - FINANCE
 * - HISTORY
 * - DOCUMENTARY
 * - KIDS
 * - GENERAL
 */

import { ContentDomain, DomainClassificationResult } from "./models";

export class DomainClassifier {
  private static readonly FINANCE_KEYWORDS = [
    "inflation", "money", "finance", "financial", "economy", "economic", "market", "stock",
    "invest", "investing", "investment", "bank", "banking", "currency", "crypto", "bitcoin",
    "gdp", "interest rate", "recession", "wealth", "revenue", "profit", "budget", "tax",
    "valuation", "portfolio", "real estate", "debt", "credit", "compound interest", "capital"
  ];

  private static readonly HISTORY_KEYWORDS = [
    "roman empire", "rome", "ancient", "history", "historical", "century", "war", "battle",
    "empire", "emperor", "dynasty", "revolution", "medieval", "pharaoh", "egypt", "greece",
    "conquest", "viking", "renaissance", "monarch", "civilization", "archaeology", "kingdom",
    "republic", "treaty", "crusade", "expansion", "timeline", "wwi", "wwii", "gladiator"
  ];

  private static readonly DOCUMENTARY_KEYWORDS = [
    "documentary", "ocean", "oceans", "nature", "wildlife", "climate", "climate change",
    "global warming", "planet", "earth", "biology", "ecosystem", "rainforest", "species",
    "animal", "science", "scientific", "deep sea", "volcano", "universe", "space", "galaxy",
    "glacier", "evolution", "atmosphere", "antarctica", "amazon", "marine", "environment"
  ];

  private static readonly KIDS_KEYWORDS = [
    "kid", "kids", "child", "children", "cartoon", "animation", "animated story", "cute",
    "lion", "bear", "bunny", "puppy", "kitten", "leo the lion", "fairy tale", "bedtime",
    "nursery", "preschool", "toddler", "storybook", "puppet", "adventure day", "fun story",
    "little friends", "learns why", "colorful meadow", "whimsical", "magical"
  ];

  /**
   * Classifies a natural-language prompt into a structured DomainClassificationResult.
   */
  public static async classify(prompt: string): Promise<DomainClassificationResult> {
    if (!prompt || prompt.trim().length === 0) {
      return {
        domain: "GENERAL",
        confidence: 0.5,
        detectedSubtopics: [],
        reasoning: "Empty or unspecified prompt defaulting to GENERAL domain"
      };
    }

    const lower = prompt.toLowerCase();

    // 1. Check deterministic heuristics
    const financeMatches = this.countMatches(lower, this.FINANCE_KEYWORDS);
    const historyMatches = this.countMatches(lower, this.HISTORY_KEYWORDS);
    const docMatches = this.countMatches(lower, this.DOCUMENTARY_KEYWORDS);
    const kidsMatches = this.countMatches(lower, this.KIDS_KEYWORDS);

    const scores: Array<{ domain: ContentDomain; count: number; matches: string[] }> = [
      { domain: "KIDS", count: kidsMatches.count, matches: kidsMatches.matchedWords },
      { domain: "FINANCE", count: financeMatches.count, matches: financeMatches.matchedWords },
      { domain: "HISTORY", count: historyMatches.count, matches: historyMatches.matchedWords },
      { domain: "DOCUMENTARY", count: docMatches.count, matches: docMatches.matchedWords }
    ];

    scores.sort((a, b) => b.count - a.count);

    const best = scores[0];
    if (best.count > 0) {
      const confidence = Math.min(0.98, 0.75 + best.count * 0.08);
      return {
        domain: best.domain,
        confidence,
        detectedSubtopics: best.matches,
        reasoning: `Deterministic heuristic matched ${best.count} key indicators for ${best.domain} (${best.matches.join(", ")})`
      };
    }

    // Default fallback if no specific keywords matched
    return {
      domain: "GENERAL",
      confidence: 0.6,
      detectedSubtopics: [],
      reasoning: "No explicit domain keywords matched; using balanced general video strategy"
    };
  }

  private static countMatches(text: string, keywords: string[]): { count: number; matchedWords: string[] } {
    let count = 0;
    const matchedWords: string[] = [];

    for (const kw of keywords) {
      // Word boundary or substring check for multi-word phrases
      const regex = new RegExp(`\\b${kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}`, "i");
      if (regex.test(text)) {
        count++;
        matchedWords.push(kw);
      }
    }

    return { count, matchedWords };
  }
}
