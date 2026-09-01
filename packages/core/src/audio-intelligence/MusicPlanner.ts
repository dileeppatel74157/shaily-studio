/**
 * Domain-Agnostic Music Planner
 * Determines soundtrack style, mood, intensity, volume, and looping
 * across Finance, History, Documentary, Kids, and General domains.
 */

import { Storyboard } from "../content-pipeline/models";
import { MusicPlanSpec } from "./models";

export class MusicPlanner {
  /**
   * Plans background soundtrack for a Storyboard.
   */
  public static planMusic(storyboard: Storyboard): MusicPlanSpec {
    const domain = (storyboard.domainClassification?.domain || "GENERAL").toUpperCase();
    const duration = storyboard.totalDurationSeconds || 20;

    switch (domain) {
      case "FINANCE":
        return {
          id: `music-${Date.now()}-fin`,
          title: "Corporate Tech Pulse",
          prompt: "Subtle modern corporate electronic synth with calm rhythmic pulses and analytical clarity",
          genreStyle: "TECH_CORPORATE",
          mood: "FOCUSED_PROFESSIONAL",
          intensity: "SUBTLE",
          targetDurationSeconds: duration,
          volume: 0.15,
          loop: true,
          fadeInSeconds: 0.5,
          fadeOutSeconds: 1.0
        };

      case "HISTORY":
        return {
          id: `music-${Date.now()}-hist`,
          title: "Echoes of Antiquity",
          prompt: "Cinematic orchestral historical atmosphere with warm acoustic strings, French horns, and stately cadence",
          genreStyle: "CINEMATIC_ORCHESTRAL",
          mood: "EPIC_REFLECTIVE",
          intensity: "BALANCED",
          targetDurationSeconds: duration,
          volume: 0.20,
          loop: true,
          fadeInSeconds: 0.8,
          fadeOutSeconds: 1.2
        };

      case "DOCUMENTARY":
        return {
          id: `music-${Date.now()}-doc`,
          title: "Oceanic Depth",
          prompt: "Deep ambient atmospheric soundscape with floating melodic pads, organic resonance, and gentle pulse",
          genreStyle: "AMBIENT_DOCUMENTARY",
          mood: "CONTEMPLATIVE_IMMERSIVE",
          intensity: "SUBTLE",
          targetDurationSeconds: duration,
          volume: 0.18,
          loop: true,
          fadeInSeconds: 1.0,
          fadeOutSeconds: 1.5
        };

      case "KIDS":
        return {
          id: `music-${Date.now()}-kids`,
          title: "Sunny Meadow Adventures",
          prompt: "Playful cheerful acoustic melody with joyful marimba, pizzicato strings, and bouncy light rhythm",
          genreStyle: "PLAYFUL_KIDS",
          mood: "JOYFUL_ENERGETIC",
          intensity: "ENERGETIC",
          targetDurationSeconds: duration,
          volume: 0.22,
          loop: true,
          fadeInSeconds: 0.3,
          fadeOutSeconds: 0.8
        };

      case "GENERAL":
      default:
        return {
          id: `music-${Date.now()}-gen`,
          title: "Inspiration Flow",
          prompt: "Clean modern educational soundtrack with uplifting acoustic piano and subtle light electronic percussion",
          genreStyle: "INFORMATIVE_UPBEAT",
          mood: "INSPIRING_CLEAR",
          intensity: "BALANCED",
          targetDurationSeconds: duration,
          volume: 0.18,
          loop: true,
          fadeInSeconds: 0.5,
          fadeOutSeconds: 1.0
        };
    }
  }
}
