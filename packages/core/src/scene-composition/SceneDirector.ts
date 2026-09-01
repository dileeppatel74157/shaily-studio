/**
 * Intelligent Scene Director
 * Central domain-agnostic orchestrator that transforms Scene, Storyboard,
 * Visual Style, Visual Plan, and Audio timing into structured SceneCompositionPlans.
 */

import {
  SceneCompositionPlan,
  SceneBeat,
  SceneBeatType,
  CompositionLayer,
  SceneTransition,
  SceneDirection,
  SceneTimingMap,
  SceneContinuityState
} from "./models";
import { Scene, Storyboard } from "../content-pipeline/models";
import { VisualStylePlan } from "../visual-intelligence/models";
import { VisualPrimitive } from "../visual-primitives/models";
import { PacingEngine } from "./PacingEngine";
import { FocusManager } from "./FocusManager";
import { ContinuityManager } from "./ContinuityManager";
import { InformationDensityEvaluator } from "./InformationDensityEvaluator";

export class SceneDirector {
  /**
   * Directs an individual scene into a comprehensive SceneCompositionPlan.
   */
  public static directScene(params: {
    scene: Scene;
    sceneIndex: number;
    storyboard: Storyboard;
    visualStylePlan?: VisualStylePlan;
    primitives?: VisualPrimitive[];
    previousContinuity?: SceneContinuityState;
  }): SceneCompositionPlan {
    const { scene, sceneIndex, storyboard, visualStylePlan, previousContinuity } = params;
    const domain = storyboard.domainClassification?.domain || "GENERAL";
    const duration = scene.durationSeconds || 5.0;
    const text = scene.scriptText || scene.title || "";
    const prims = params.primitives || scene.visualPlan?.visualPrimitives || (scene as any).visualPrimitives || [];

    // 1. Resolve Pacing Profile
    const pacing = PacingEngine.resolveProfileForDomain(domain);

    // 2. Derive Continuity State
    const continuity = ContinuityManager.deriveContinuity({
      scene,
      sceneIndex,
      storyboard,
      visualStylePlan,
      previousContinuity
    });

    // 3. Evaluate Information Hierarchy & Density
    const informationHierarchy = InformationDensityEvaluator.evaluateHierarchy({
      visualPlan: scene.visualPlan,
      primitives: prims,
      scriptText: text
    });

    // 4. Plan Focus Targets
    const focusTargets = FocusManager.planFocusSequence(prims, duration);

    // 5. Generate Scene Beats
    const beats = this.generateSceneBeats({
      scene,
      sceneIndex,
      duration,
      domain,
      text,
      primitives: prims,
      focusTargets
    });

    // 6. Assemble Composition Layers
    const visualLayers = this.assembleCompositionLayers({
      scene,
      primitives: prims,
      duration
    });

    // 7. Generate Timing Map & Narration Sync Points
    const timingMap = this.generateTimingMap({
      duration,
      beats,
      text
    });

    // 8. Determine Camera Direction
    const cameraDirection = this.determineCameraDirection({
      scene,
      visualStylePlan,
      focusTargets
    });

    // 9. Determine Scene Transition
    const transition = this.determineTransition({
      sceneIndex,
      scene,
      visualStylePlan
    });

    return {
      sceneId: scene.id || `scene-${sceneIndex}`,
      sceneNumber: scene.sceneNumber || sceneIndex + 1,
      domain,
      durationSeconds: duration,
      objective: scene.visualPlan?.visualObjective || `Direct visual narrative for scene ${sceneIndex + 1}`,
      narrativePurpose: scene.visualPlan?.purpose || `Deliver core information: ${text.substring(0, 40)}...`,
      beats,
      visualLayers,
      focusTargets,
      timingMap,
      pacing,
      cameraDirection,
      transition,
      continuity,
      informationHierarchy,
      confidence: storyboard.domainClassification?.confidence || 0.95
    };
  }

  /**
   * Generates structured temporal beats for the scene.
   */
  private static generateSceneBeats(params: {
    scene: Scene;
    sceneIndex: number;
    duration: number;
    domain: string;
    text: string;
    primitives: VisualPrimitive[];
    focusTargets: ReturnType<typeof FocusManager.planFocusSequence>;
  }): SceneBeat[] {
    const { scene, sceneIndex, duration, domain, text, primitives, focusTargets } = params;
    const beats: SceneBeat[] = [];
    const numBeats = Math.max(2, Math.min(4, Math.floor(duration / 2)));
    const beatDuration = duration / numBeats;

    const beatTypesByDomain: Record<string, SceneBeatType[]> = {
      FINANCE: ["INTRO", "STATISTIC", "COMPARISON", "SUMMARY"],
      HISTORY: ["INTRO", "MAP_REVEAL", "TIMELINE_EVENT", "SUMMARY"],
      DOCUMENTARY: ["INTRO", "EXPLANATION", "DEMONSTRATION", "EMPHASIS"],
      KIDS: ["INTRO", "CHARACTER_ACTION", "DIALOGUE", "OUTRO"],
      GENERAL: ["INTRO", "EXPLANATION", "DEMONSTRATION", "SUMMARY"]
    };

    const targetTypes = beatTypesByDomain[domain.toUpperCase()] || beatTypesByDomain.GENERAL;

    for (let i = 0; i < numBeats; i++) {
      const beatType = targetTypes[i % targetTypes.length];
      const startTime = Number((i * beatDuration).toFixed(2));
      const focus = focusTargets[i % focusTargets.length];

      beats.push({
        id: `beat-${scene.id || sceneIndex}-${i}`,
        type: beatType,
        startTimeSeconds: startTime,
        durationSeconds: Number(beatDuration.toFixed(2)),
        purpose: `Scene ${sceneIndex + 1} Beat ${i + 1}: ${beatType}`,
        narrationReference: text.substring(0, Math.min(text.length, (i + 1) * 35)),
        visualObjective: `Show visual representation for ${beatType}`,
        focusTarget: focus,
        requiredAssets: focus?.targetId ? [focus.targetId] : [],
        primitives: primitives.slice(i, i + 1),
        audioRelationship: {
          duckMusic: true,
          playSfxCue: i > 0 ? "WHOOSH" : undefined,
          speechSync: true
        }
      });
    }

    return beats;
  }

  /**
   * Assembles composition layers with z-index and entrance transitions.
   */
  private static assembleCompositionLayers(params: {
    scene: Scene;
    primitives: VisualPrimitive[];
    duration: number;
  }): CompositionLayer[] {
    const { scene, primitives, duration } = params;
    const layers: CompositionLayer[] = [];

    // Background Layer
    layers.push({
      id: `layer-bg-${scene.id}`,
      name: "Background Layer",
      hierarchyLevel: "BACKGROUND",
      zIndex: 0,
      startTimeSeconds: 0,
      durationSeconds: duration,
      enterTransition: "FADE",
      opacity: 1.0,
      scale: 1.0
    });

    // Primitive / Foreground Layers
    for (let i = 0; i < primitives.length; i++) {
      const p = primitives[i];
      let level: CompositionLayer["hierarchyLevel"] = "SUPPORTING";
      if (p.type === "LINE_CHART" || p.type === "BAR_CHART" || p.type === "AREA_CHART" || p.type === "DONUT_CHART" || p.type === "CHARACTER") {
        level = "PRIMARY";
      } else if (p.type === "STAT_CARD" || p.type === "NUMBER_COUNTER" || p.type === "TIMELINE" || p.type === "INFO_CARD") {
        level = "SECONDARY";
      }


      layers.push({
        id: `layer-${p.id || i}`,
        name: `${p.type} Layer`,
        hierarchyLevel: level,
        zIndex: p.zIndex || (i + 1) * 10,
        primitive: p,
        startTimeSeconds: Number((p.startTime || (i * 0.5)).toFixed(2)),
        durationSeconds: Number((p.duration || (duration - (p.startTime || 0))).toFixed(2)),
        enterTransition: (p.animation?.behavior as any) || "SLIDE",
        opacity: p.opacity ?? 1.0,
        scale: 1.0
      });
    }


    return layers;
  }

  /**
   * Generates scene timing cues and narration sync points.
   */
  private static generateTimingMap(params: {
    duration: number;
    beats: SceneBeat[];
    text: string;
  }): SceneTimingMap {
    const { duration, beats, text } = params;
    const cues = beats.map((b, i) => ({
      id: `cue-${b.id}`,
      timestampSeconds: b.startTimeSeconds,
      label: `Beat ${i + 1}: ${b.type}`,
      action: `TRIGGER_${b.type}`,
      targetElementId: b.focusTarget?.targetId
    }));

    const words = text.split(" ");
    const narrationSyncPoints = beats.map((b, i) => ({
      speechOffsetSeconds: b.startTimeSeconds,
      speechTextSnippet: words.slice(i * 4, (i + 1) * 4).join(" "),
      visualEventId: b.id
    }));

    return {
      totalDurationSeconds: duration,
      cues,
      narrationSyncPoints
    };
  }

  /**
   * Determines camera framing and motion direction.
   */
  private static determineCameraDirection(params: {
    scene: Scene;
    visualStylePlan?: VisualStylePlan;
    focusTargets: ReturnType<typeof FocusManager.planFocusSequence>;
  }): SceneDirection {
    const { scene, visualStylePlan, focusTargets } = params;
    const primaryFocus = focusTargets[0];
    const preferredMotion = visualStylePlan?.cameraStyle.preferredMotion || "KEN_BURNS";
    const intensity = visualStylePlan?.cameraStyle.intensity || 1.0;

    return {
      focalPoint: primaryFocus?.framingAnchor || { x: 960, y: 540 },
      motionPreset: typeof scene.cameraMotion === "string" ? scene.cameraMotion : preferredMotion,
      intensity,
      panningVector: { dx: 10, dy: 0 }
    };
  }

  /**
   * Determines semantic scene transition.
   */
  private static determineTransition(params: {
    sceneIndex: number;
    scene: Scene;
    visualStylePlan?: VisualStylePlan;
  }): SceneTransition {
    const { sceneIndex, scene, visualStylePlan } = params;
    const transitionStyle = visualStylePlan?.transitionStyle || "CUT";

    return {
      type: sceneIndex === 0 ? "FADE" : ((scene.transition as any) || transitionStyle),
      durationSeconds: 0.5,
      direction: "RIGHT",
      easing: "easeInOutQuad"
    };
  }
}
