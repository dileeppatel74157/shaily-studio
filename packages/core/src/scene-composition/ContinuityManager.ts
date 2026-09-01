/**
 * Scene Continuity Manager
 * Preserves character spatial positioning, visual motifs, environmental identity,
 * and narrative progression across sequential scenes in a video production.
 */

import { SceneContinuityState } from "./models";
import { Scene, Storyboard } from "../content-pipeline/models";
import { VisualStylePlan } from "../visual-intelligence/models";

export class ContinuityManager {
  /**
   * Derives continuity state for a scene, preserving historical context.
   */
  public static deriveContinuity(params: {
    scene: Scene;
    sceneIndex: number;
    storyboard: Storyboard;
    visualStylePlan?: VisualStylePlan;
    previousContinuity?: SceneContinuityState;
  }): SceneContinuityState {
    const { scene, sceneIndex, storyboard, visualStylePlan, previousContinuity } = params;
    const totalScenes = storyboard.scenes.length || 1;
    const progressRatio = Number(((sceneIndex + 1) / totalScenes).toFixed(2));

    // 1. Character Continuity
    const persistentCharacters: SceneContinuityState["persistentCharacters"] = [];
    if (scene.characterConfiguration?.characterId) {
      const prevChar = previousContinuity?.persistentCharacters.find(
        c => c.characterId === scene.characterConfiguration?.characterId
      );

      // Preserve or evolve position smoothly
      const defaultPos = { x: 960, y: 540 };
      const currentPos = prevChar
        ? { x: prevChar.lastPosition.x, y: prevChar.lastPosition.y }
        : (scene.characterConfiguration.position || defaultPos);

      persistentCharacters.push({
        characterId: scene.characterConfiguration.characterId,
        name: scene.characterConfiguration.name || "Main Character",
        lastPosition: currentPos,
        currentPose: scene.characterConfiguration.pose || "IDLE",
        expression: scene.characterConfiguration.expression || "DEFAULT"
      });
    }

    // 2. Environmental Identity Continuity
    const domain = (storyboard.domainClassification?.domain || "GENERAL").toUpperCase();
    const primaryColor = visualStylePlan?.colorDirection.primary || (domain === "FINANCE" ? "#0A2540" : "#1A1A2E");
    const bgStyle = visualStylePlan?.backgroundStrategy.style || "DATA_GRID";

    const environmentIdentity = {
      theme: domain,
      backgroundStyle: bgStyle,
      primaryColor: previousContinuity ? previousContinuity.environmentIdentity.primaryColor : primaryColor
    };

    // 3. Visual Motifs
    const activeVisualMotifs = previousContinuity
      ? [...previousContinuity.activeVisualMotifs]
      : [`MOTIF_${domain}`];

    if (!activeVisualMotifs.includes(`MOTIF_${domain}`)) {
      activeVisualMotifs.push(`MOTIF_${domain}`);
    }

    // 4. Camera Context
    const cameraMotion = scene.cameraMotion || scene.visualPlan?.cameraMotion || "STATIC";
    const cameraContext = {
      lastFraming: typeof cameraMotion === "string" ? cameraMotion : cameraMotion.type || "STATIC",
      lastFocalPoint: { x: 960, y: 540 }
    };

    return {
      sceneId: scene.id || `scene-${sceneIndex}`,
      sceneNumber: scene.sceneNumber || sceneIndex + 1,
      persistentCharacters,
      environmentIdentity,
      activeVisualMotifs,
      cameraContext,
      narrativeState: {
        storyProgressRatio: progressRatio,
        keyTakeawayCount: sceneIndex + 1
      }
    };
  }
}
