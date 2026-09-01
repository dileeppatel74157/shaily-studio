/**
 * Asset Requirement Planner
 * Analyzes SceneVisualPlan, VisualStylePlan, and Scene content to extract
 * structured, semantic asset requirements.
 *
 * Domain-agnostic: operates from visual requirements across Finance, History, Documentary, Kids, General.
 */

import { Scene, Storyboard, VisualStylePlan } from "../content-pipeline/models";
import {
  AssetRequirement,
  SceneAssetRequirements,
  AssetRequirementPlan,
  AssetKind
} from "./models";

export class AssetRequirementPlanner {
  /**
   * Extracts asset requirements for an entire Storyboard.
   */
  public static planStoryboardRequirements(
    storyboard: Storyboard,
    stylePlan?: VisualStylePlan
  ): AssetRequirementPlan {
    const sceneRequirements: SceneAssetRequirements[] = [];
    let totalCount = 0;

    for (const scene of storyboard.scenes) {
      const reqs = this.planSceneRequirements(scene, stylePlan);
      sceneRequirements.push({
        sceneId: scene.id,
        requirements: reqs
      });
      totalCount += reqs.length;
    }

    return {
      projectId: storyboard.projectId || "project-default",
      scenes: sceneRequirements,
      totalRequirements: totalCount
    };
  }

  /**
   * Extracts asset requirements for a single Scene.
   */
  public static planSceneRequirements(
    scene: Scene,
    stylePlan?: VisualStylePlan
  ): AssetRequirement[] {
    const requirements: AssetRequirement[] = [];
    const vp = scene.visualPlan;
    const styleDesc = stylePlan?.visualStyle || (stylePlan as any)?.overallDirection || "High-definition, modern cinematic lighting and clean visual clarity";

    // 1. Background Requirement
    const bgShot = scene.shots?.[0];
    const bgPrompt = bgShot?.visualPrompt || scene.title || "Cinematic visual environment";
    const bgKind: AssetKind =
      vp?.dominantVisualType === "MAP" ? "MAP" :
      vp?.dominantVisualType === "DIAGRAM" ? "DIAGRAM" : "BACKGROUND";

    requirements.push({
      id: `req-bg-${scene.id}`,
      sceneId: scene.id,
      shotId: bgShot?.id,
      kind: bgKind,
      semanticRole: "background",
      prompt: `${bgPrompt}. Style: ${styleDesc}`,
      styleDescription: styleDesc,
      desiredDimensions: { width: 1920, height: 1080, aspectRatio: "16:9" },
      requiresAlpha: false,
      isOptional: false,
      isReusable: false,
      metadata: {
        dominantVisualType: vp?.dominantVisualType || scene.visualType || "IMAGE",
        purpose: vp?.purpose
      }
    });

    // 2. Character Layer Requirement (if scene involves a character)
    const charConfig = scene.characterConfiguration;
    if (charConfig?.characterId) {
      const charName = charConfig.name || "Main Character";
      const charPrompt = `2D character illustration, ${charName}, full body character pose, isolated on pure transparent background, crisp line art, vibrant clean colors`;

      requirements.push({
        id: `req-char-${scene.id}-${charConfig.characterId}`,
        sceneId: scene.id,
        kind: "CHARACTER",
        semanticRole: "character-protagonist",
        characterId: charConfig.characterId,
        prompt: charPrompt,
        styleDescription: styleDesc,
        desiredDimensions: { width: 512, height: 512, aspectRatio: "1:1" },
        requiresAlpha: true,
        isOptional: false,
        isReusable: true, // Character root asset is highly reusable across scenes!
        metadata: {
          characterName: charName,
          actionPreset: scene.animation || "WALK"
        }
      });
    }

    // 3. Additional Visual Plan Layers (e.g. archival photos, diagram overlays, prop layers)
    if (vp?.layers && Array.isArray(vp.layers)) {
      for (const layer of vp.layers) {
        if (layer.layerType === "PROP" || layer.layerType === "MIDGROUND") {
          requirements.push({
            id: `req-layer-${scene.id}-${layer.id}`,
            sceneId: scene.id,
            kind: layer.layerType === "PROP" ? "DIAGRAM" : "FOREGROUND",
            semanticRole: layer.layerType.toLowerCase(),
            prompt: `${layer.name || "Visual element"}, isolated clean subject on transparent background`,
            styleDescription: styleDesc,
            desiredDimensions: { width: 640, height: 640, aspectRatio: "1:1" },
            requiresAlpha: true,
            isOptional: true,
            isReusable: true
          });
        }
      }
    }

    return requirements;
  }
}
