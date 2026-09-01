/**
 * Focus & Visual Prominence Manager
 * Directs viewer attention across objects, charts, characters, and metrics
 * with temporal enter, hold, exit, and transition lifecycles.
 */

import { FocusTarget, FocusType } from "./models";
import { VisualPrimitive } from "../visual-primitives/models";

export class FocusManager {
  /**
   * Creates a FocusTarget with timing and visual prominence metrics.
   */
  public static createFocusTarget(params: {
    id: string;
    type: FocusType;
    targetId?: string;
    enterOffsetSeconds: number;
    holdDurationSeconds: number;
    visualProminence?: number;
    scaleMultiplier?: number;
    framingAnchor?: { x: number; y: number };
  }): FocusTarget {
    return {
      id: params.id,
      type: params.type,
      targetId: params.targetId,
      enterOffsetSeconds: params.enterOffsetSeconds,
      holdDurationSeconds: params.holdDurationSeconds,
      exitOffsetSeconds: params.enterOffsetSeconds + params.holdDurationSeconds,
      visualProminence: params.visualProminence ?? 0.9,
      scaleMultiplier: params.scaleMultiplier ?? 1.05,
      framingAnchor: params.framingAnchor || { x: 960, y: 540 }
    };
  }

  /**
   * Plans sequential focus transitions for a set of visual primitives.
   */
  public static planFocusSequence(
    primitives: VisualPrimitive[],
    sceneDuration: number
  ): FocusTarget[] {
    if (primitives.length === 0) {
      return [
        this.createFocusTarget({
          id: "focus-full-scene",
          type: "FULL_SCENE",
          enterOffsetSeconds: 0,
          holdDurationSeconds: sceneDuration,
          visualProminence: 1.0
        })
      ];
    }

    const targets: FocusTarget[] = [];
    const beatDur = sceneDuration / Math.max(1, primitives.length);

    for (let i = 0; i < primitives.length; i++) {
      const p = primitives[i];
      let focusType: FocusType = "OBJECT";

      if (p.type === "LINE_CHART" || p.type === "BAR_CHART" || p.type === "AREA_CHART" || p.type === "DONUT_CHART") {
        focusType = "CHART";
      } else if (p.type === "NUMBER_COUNTER" || p.type === "STAT_CARD" || p.type === "PERCENTAGE_INDICATOR") {
        focusType = "NUMBER";
      } else if (p.type === "CHARACTER") {
        focusType = "CHARACTER";
      } else if (p.type === "CALLOUT" || p.type === "INFO_CARD" || p.type === "LOWER_THIRD") {
        focusType = "CALLOUT";
      } else if (p.type === "TEXT") {
        focusType = "TEXT";
      } else if (p.type === "IMAGE") {
        focusType = "IMAGE";
      }

      targets.push(
        this.createFocusTarget({
          id: `focus-${p.id || i}`,
          type: focusType,
          targetId: p.id,
          enterOffsetSeconds: Number((i * beatDur).toFixed(2)),
          holdDurationSeconds: Number(beatDur.toFixed(2)),
          visualProminence: i === 0 ? 1.0 : 0.85,
          scaleMultiplier: 1.05,
          framingAnchor: p.position ? { x: (p.position.x + ((p.position.width || 0.5) / 2)) * 1920, y: (p.position.y + ((p.position.height || 0.5) / 2)) * 1080 } : { x: 960, y: 540 }
        })
      );
    }


    return targets;
  }
}
