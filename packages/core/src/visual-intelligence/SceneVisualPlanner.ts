/**
 * Scene Visual Planner
 * Translates project-level VisualStylePlan and Scene script content into
 * structured, multi-layer SceneVisualPlan instances ready for timeline composition & rendering.
 */

import {
  VisualStylePlan,
  SceneVisualPlan,
  DataVisualizationSpec,
  OverlaySpec
} from "./models";
import {
  SceneVisualLayer,
  CameraMotion,
  AnimationInstruction,
  SceneCharacter
} from "../animation/models";

export class SceneVisualPlanner {
  /**
   * Plans the visual layers, camera movement, data visualizers, and animation actions for a single scene.
   */
  public static planScene(
    scene: {
      id: string;
      sceneNumber: number;
      title: string;
      scriptText: string;
      durationSeconds: number;
      visualPrompt?: string;
      animation?: string;
      cameraMotion?: CameraMotion;
      layers?: any[];
      characterConfiguration?: any;
      animationInstructions?: AnimationInstruction[];
    },
    stylePlan: VisualStylePlan,
    characters: SceneCharacter[] = []
  ): SceneVisualPlan {
    const domain = stylePlan.domain;
    const dur = scene.durationSeconds || 5;

    // 1. Determine Scene Purpose and Visual Objective
    const purpose = `${domain} explainer segment ${scene.sceneNumber}: ${scene.title}`;
    const visualObjective = scene.visualPrompt || `Visualize ${scene.title} in ${stylePlan.visualStyle} aesthetic`;

    // 2. Camera Motion Planning
    const cameraMotion: CameraMotion = scene.cameraMotion || {
      type: stylePlan.cameraStyle.preferredMotion,
      intensity: stylePlan.cameraStyle.intensity
    };

    // 3. Layer Planning
    const layers: SceneVisualLayer[] = [];
    const animationInstructions: AnimationInstruction[] = [];
    const overlays: OverlaySpec[] = [];
    const dataVisualizations: DataVisualizationSpec[] = [];

    // Layer 0: Background
    layers.push({
      id: `${scene.id}-bg`,
      layerType: "BACKGROUND",
      assetUrl: "",
      zIndex: 0,
      parallaxRate: stylePlan.backgroundStrategy.parallaxEnabled ? 0.3 : 0.0
    });

    // Domain-Specific Visual Strategy & Elements
    if (domain === "FINANCE") {
      // Overlays and Data Visualizations for Finance
      if (scene.sceneNumber === 1) {
        overlays.push({
          id: `ov-${scene.id}-title`,
          type: "LOWER_THIRD",
          text: scene.title.toUpperCase(),
          subtext: "Economic Concepts Explained",
          position: "LOWER_THIRD",
          animation: "SLIDE_UP"
        });
      } else if (scene.sceneNumber === 2 || scene.sceneNumber === 3) {
        dataVisualizations.push({
          id: `dv-${scene.id}-chart`,
          type: "CHART",
          chartType: "LINE",
          title: "Purchasing Power Over Time",
          unit: "%",
          data: [
            { label: "Year 1", value: 100, color: stylePlan.colorDirection.accent },
            { label: "Year 5", value: 85, color: stylePlan.colorDirection.secondary },
            { label: "Year 10", value: 65, color: stylePlan.colorDirection.primary }
          ],
          animation: "DRAW",
          position: { x: 0.5, y: 0.5, width: 0.6, height: 0.5 }
        });
      } else {
        overlays.push({
          id: `ov-${scene.id}-stat`,
          type: "INFOGRAPHIC_CARD",
          text: "Key Takeaway",
          subtext: "Invest to preserve purchasing power",
          position: "CENTER",
          animation: "ZOOM_IN"
        });
      }
    } else if (domain === "HISTORY") {
      // History Maps, Timelines & Artifacts
      if (scene.sceneNumber === 1) {
        overlays.push({
          id: `ov-${scene.id}-era`,
          type: "BADGE",
          text: "HISTORICAL ERA",
          subtext: "Mediterranean Conquests",
          position: "TOP_LEFT",
          animation: "FADE_IN"
        });
      } else if (scene.sceneNumber === 2 || scene.sceneNumber === 3) {
        dataVisualizations.push({
          id: `dv-${scene.id}-map`,
          type: "MAP",
          title: "Territorial Expansion Boundaries",
          animation: "REVEAL",
          position: { x: 0.5, y: 0.5, width: 0.75, height: 0.6 }
        });
      }
    } else if (domain === "DOCUMENTARY") {
      // Documentary Scientific Overlays & Data Callouts
      overlays.push({
        id: `ov-${scene.id}-data`,
        type: "CALLOUT",
        text: scene.title,
        subtext: "Global Marine Climate Analysis",
        position: "BOTTOM_LEFT",
        animation: "FADE_IN"
      });
      if (scene.sceneNumber === 2 || scene.sceneNumber === 3) {
        dataVisualizations.push({
          id: `dv-${scene.id}-temp`,
          type: "INDICATOR",
          title: "Global Ocean Surface Temperature",
          unit: "°C Anomaly",
          data: { baseline: 0.0, current: +1.2 },
          animation: "PULSE"
        });
      }
    } else if (domain === "KIDS") {
      // Character layer & expressive locomotion for Kids
      const char = characters[0] || { id: "char-main", name: "Protagonist" };
      const action = (scene.animation as any) || (scene.sceneNumber === 1 ? "ENTER_LEFT" : scene.sceneNumber === 2 ? "WALK" : scene.sceneNumber === 3 ? "JUMP" : "WAVE");

      const startX = scene.animationInstructions?.[0]?.movement?.startX ?? (action === "ENTER_LEFT" ? 0.35 : action === "WALK" ? 0.15 : 0.2);
      const startY = scene.animationInstructions?.[0]?.movement?.startY ?? 0.65;
      const endX = scene.animationInstructions?.[0]?.movement?.endX ?? (action === "ENTER_LEFT" ? 0.35 : action === "WALK" ? 0.82 : 0.8);
      const endY = scene.animationInstructions?.[0]?.movement?.endY ?? 0.65;

      layers.push({
        id: `${scene.id}-char-${char.id}`,
        layerType: "CHARACTER",
        assetUrl: char.assetUrl || "",
        actionPreset: action,
        movement: { startX, startY, endX, endY },
        zIndex: 1,
        initialPosition: { x: startX, y: startY, width: 0.35, height: 0.52 }
      });

      animationInstructions.push({
        characterId: char.id,
        action,
        movement: { startX, startY, endX, endY }
      });
    }

    // Determine dominant visual type
    let dominantVisualType: "IMAGE" | "CHARACTER" | "CHART" | "MAP" | "INFOGRAPHIC" | "DIAGRAM" = "IMAGE";
    if (domain === "KIDS") dominantVisualType = "CHARACTER";
    else if (dataVisualizations.some(d => d.type === "CHART")) dominantVisualType = "CHART";
    else if (dataVisualizations.some(d => d.type === "MAP")) dominantVisualType = "MAP";
    else if (overlays.some(o => o.type === "INFOGRAPHIC_CARD")) dominantVisualType = "INFOGRAPHIC";

    return {
      purpose,
      visualObjective,
      layers,
      cameraMotion,
      animationInstructions,
      overlays,
      dataVisualizations,
      dominantVisualType
    };
  }
}
