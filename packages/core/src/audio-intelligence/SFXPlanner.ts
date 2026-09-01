/**
 * Semantic SFX Planner
 * Evaluates scene transitions, visual primitive cues, and character motions
 * to generate structured, necessary sound effects.
 */

import { Scene, Storyboard } from "../content-pipeline/models";
import { SFXCueSpec } from "./models";

export class SFXPlanner {
  /**
   * Plans sound effects for a Storyboard.
   */
  public static planSFX(storyboard: Storyboard): SFXCueSpec[] {
    const sfxList: SFXCueSpec[] = [];

    for (let i = 0; i < storyboard.scenes.length; i++) {
      const scene = storyboard.scenes[i];
      const cues = this.planSceneSFX(scene, i);
      sfxList.push(...cues);
    }

    return sfxList;
  }

  /**
   * Plans sound effects for a single Scene.
   */
  public static planSceneSFX(scene: Scene, sceneIndex: number): SFXCueSpec[] {
    const cues: SFXCueSpec[] = [];
    const vp = scene.visualPlan;

    // 1. Transition sound effect (e.g. whoosh on scene change)
    if (sceneIndex > 0) {
      cues.push({
        id: `sfx-trans-${scene.id || sceneIndex}`,
        sceneId: scene.id,
        semanticCue: "WHOOSH",
        prompt: "Smooth subtle cinematic whoosh transition",
        triggerOffsetSeconds: 0.1,
        durationSeconds: 0.8,
        volume: 0.35
      });
    }

    // 2. Data visualization cue (click/pop for charts/counters)
    if (vp?.dataVisualizations && vp.dataVisualizations.length > 0) {
      cues.push({
        id: `sfx-dataviz-${scene.id || sceneIndex}`,
        sceneId: scene.id,
        semanticCue: "CLICK",
        prompt: "Clean modern UI pop and digital data click",
        triggerOffsetSeconds: 0.8,
        durationSeconds: 0.5,
        volume: 0.4
      });
    }

    // 3. Character animation cue (bounce/step for kids/avatar actions)
    if (scene.characterConfiguration?.characterId) {
      const action = scene.animation || "WALK";
      cues.push({
        id: `sfx-char-${scene.id || sceneIndex}`,
        sceneId: scene.id,
        semanticCue: action === "JUMP" ? "BOUNCE" : "POP",
        prompt: action === "JUMP" ? "Cartoon spring bounce sound" : "Soft playful cartoon step",
        triggerOffsetSeconds: 1.2,
        durationSeconds: 0.6,
        volume: 0.45
      });
    }

    return cues;
  }
}
