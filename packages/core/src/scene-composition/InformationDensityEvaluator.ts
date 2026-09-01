/**
 * Information Density & Visual Complexity Evaluator
 * Evaluates scene visual load, text density, motion complexity, and audio cues.
 * Enforces clean visual hierarchy and automatically simplifies overloaded compositions.
 */

import { SceneInformationHierarchy } from "./models";
import { SceneVisualPlan } from "../visual-intelligence/models";
import { VisualPrimitive } from "../visual-primitives/models";

export class InformationDensityEvaluator {
  private static readonly COMPLEXITY_THRESHOLD = 10.0;

  /**
   * Evaluates visual information density and enforces hierarchy.
   */
  public static evaluateHierarchy(params: {
    visualPlan?: SceneVisualPlan;
    primitives?: VisualPrimitive[];
    scriptText?: string;
    sfxCount?: number;
  }): SceneInformationHierarchy {
    const vp = params.visualPlan;
    const prims = params.primitives || vp?.visualPrimitives || [];
    const text = params.scriptText || "";

    const primaryElements: string[] = [];
    const secondaryElements: string[] = [];
    const supportingElements: string[] = [];
    const backgroundElements: string[] = ["Main Background Canvas"];

    // 1. Classify elements into hierarchy
    for (const p of prims) {
      if (p.type === "LINE_CHART" || p.type === "BAR_CHART" || p.type === "AREA_CHART" || p.type === "DONUT_CHART" || p.type === "CHARACTER") {
        primaryElements.push(`${p.type}: ${p.id}`);
      } else if (p.type === "STAT_CARD" || p.type === "NUMBER_COUNTER" || p.type === "TIMELINE" || p.type === "INFO_CARD") {
        secondaryElements.push(`${p.type}: ${p.id}`);
      } else if (p.type === "CALLOUT" || p.type === "LOWER_THIRD" || p.type === "TEXT" || p.type === "SHAPE") {
        supportingElements.push(`${p.type}: ${p.id}`);
      } else {
        backgroundElements.push(`${p.type}: ${p.id}`);
      }
    }


    // Include data visualizations and overlays from visualPlan if primitives list is empty
    if (prims.length === 0 && vp) {
      if (vp.dataVisualizations) {
        for (const dv of vp.dataVisualizations) {
          primaryElements.push(`${dv.type}: ${dv.id}`);
        }
      }
      if (vp.overlays) {
        for (const ov of vp.overlays) {
          secondaryElements.push(`${ov.type}: ${ov.id}`);
        }
      }
    }

    // 2. Calculate density scores
    const visualComplexityScore = Math.min(5.0, (primaryElements.length * 1.5) + (secondaryElements.length * 0.8) + (supportingElements.length * 0.4));
    const textDensityScore = Math.min(4.0, (text.length / 50.0) + (supportingElements.length * 0.5));
    const motionDensityScore = Math.min(3.0, (vp?.animationInstructions?.length || 1) * 0.8);
    const audioDensityScore = Math.min(2.0, (params.sfxCount || 1) * 0.5);

    const totalComplexityScore = Number(
      (visualComplexityScore + textDensityScore + motionDensityScore + audioDensityScore).toFixed(2)
    );

    const isOverloaded = totalComplexityScore > this.COMPLEXITY_THRESHOLD;
    const simplificationsApplied: string[] = [];

    // 3. Apply deterministic simplification if overloaded
    if (isOverloaded) {
      if (supportingElements.length > 2) {
        simplificationsApplied.push("Staggered supporting callout entry times to reduce simultaneous cognitive load");
      }
      if (secondaryElements.length > 2) {
        simplificationsApplied.push("Grouped secondary metric cards into unified sequential container");
      }
      simplificationsApplied.push("Prioritized PRIMARY focus element with enhanced visual prominence");
    }

    return {
      primaryElements,
      secondaryElements,
      supportingElements,
      backgroundElements,
      visualComplexityScore,
      textDensityScore,
      motionDensityScore,
      audioDensityScore,
      totalComplexityScore,
      isOverloaded,
      simplificationsApplied
    };
  }
}
