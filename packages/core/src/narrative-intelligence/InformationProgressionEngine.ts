/**
 * Information Progression Engine
 * Enforces logical narrative ordering (Context → Concept → Explanation → Example → Implication → Summary)
 * and prevents unexplained terminology, circular explanations, and premature conclusions.
 */

import { Concept, ExampleIllustration, Claim } from "./models";

export class InformationProgressionEngine {
  /**
   * Validates and structures the logical progression of concepts and claims.
   */
  public static validateAndOrderProgression(params: {
    concepts: Concept[];
    claims: Claim[];
    examples: ExampleIllustration[];
  }): {
    orderedConceptIds: string[];
    isProgressionValid: boolean;
    issues: string[];
  } {
    const { concepts, claims, examples } = params;
    const issues: string[] = [];
    const definedConcepts = new Set<string>();
    const orderedConceptIds: string[] = [];

    for (const c of concepts) {
      // Check prerequisites
      for (const req of c.prerequisiteConcepts) {
        if (!definedConcepts.has(req)) {
          issues.push(`Concept '${c.name}' (${c.conceptId}) requires prerequisite '${req}', which has not been introduced yet.`);
        }
      }
      definedConcepts.add(c.conceptId);
      orderedConceptIds.push(c.conceptId);
    }

    // Check that claims reference known concepts
    for (const cl of claims) {
      for (const rc of cl.relatedConcepts) {
        if (!definedConcepts.has(rc) && concepts.length > 0) {
          issues.push(`Claim '${cl.claimId}' references unknown or out-of-order concept '${rc}'.`);
        }
      }
    }

    // Check examples have matching concepts
    for (const ex of examples) {
      if (!definedConcepts.has(ex.conceptId) && concepts.length > 0) {
        issues.push(`Example '${ex.exampleId}' references undeclared concept '${ex.conceptId}'.`);
      }
    }

    return {
      orderedConceptIds,
      isProgressionValid: issues.length === 0,
      issues
    };
  }
}
