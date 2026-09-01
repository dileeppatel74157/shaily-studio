/**
 * Narration Planner
 * Plans domain-aware voice personas, emotional tones, pacing, and structured
 * narration requirements across Finance, History, Documentary, Kids, and General.
 */

import { Storyboard, Scene } from "../content-pipeline/models";
import { NarrationPlan, NarrationSegmentSpec } from "./models";

export class NarrationPlanner {
  /**
   * Plans narration for an entire Storyboard.
   */
  public static planNarration(storyboard: Storyboard): NarrationPlan {
    const domain = storyboard.domainClassification?.domain || "GENERAL";
    const voicePersona = this.resolveVoicePersonaForDomain(domain);
    const segments: NarrationSegmentSpec[] = [];

    let currentOffset = 0;

    for (let i = 0; i < storyboard.scenes.length; i++) {
      const scene = storyboard.scenes[i];
      const text = scene.scriptText || scene.title || "";
      const expectedDuration = scene.durationSeconds || Math.max(2, Math.ceil(text.length / 15));

      const seg: NarrationSegmentSpec = {
        id: `vox-seg-${scene.id || i}`,
        sceneId: scene.id,
        text,
        speakerId: scene.characterConfiguration?.name || voicePersona.defaultSpeaker,
        voiceId: voicePersona.voiceId,
        language: "en-US",
        emotion: voicePersona.emotion,
        expectedDurationSeconds: expectedDuration,
        startOffsetSeconds: currentOffset,
        pauseBeforeSeconds: i === 0 ? 0.2 : 0.1,
        pauseAfterSeconds: 0.2
      };

      segments.push(seg);
      currentOffset += expectedDuration;
    }

    return {
      projectId: storyboard.projectId || "project-default",
      voicePersona: voicePersona.persona,
      segments,
      totalExpectedDurationSeconds: currentOffset
    };
  }

  /**
   * Resolves appropriate voice persona and emotion by domain.
   */
  public static resolveVoicePersonaForDomain(domain: string): {
    persona: string;
    voiceId: string;
    defaultSpeaker: string;
    emotion: string;
    speakingRate: number;
  } {
    switch (domain.toUpperCase()) {
      case "FINANCE":
        return {
          persona: "AUTHORITATIVE_CLEAR",
          voiceId: "Rachel",
          defaultSpeaker: "Financial Analyst",
          emotion: "CONFIDENT",
          speakingRate: 1.05
        };
      case "HISTORY":
        return {
          persona: "STORYTELLER_WARM",
          voiceId: "George",
          defaultSpeaker: "Historian",
          emotion: "ENGAGING",
          speakingRate: 0.95
        };
      case "DOCUMENTARY":
        return {
          persona: "CALM_MEASURED",
          voiceId: "David",
          defaultSpeaker: "Narrator",
          emotion: "OBJECTIVE",
          speakingRate: 0.98
        };
      case "KIDS":
        return {
          persona: "PLAYFUL_ENTHUSIASTIC",
          voiceId: "Lily",
          defaultSpeaker: "Storyteller",
          emotion: "JOYFUL",
          speakingRate: 1.0
        };
      case "GENERAL":
      default:
        return {
          persona: "INFORMATIVE_NATURAL",
          voiceId: "Rachel",
          defaultSpeaker: "Educator",
          emotion: "NEUTRAL",
          speakingRate: 1.0
        };
    }
  }
}
