/**
 * Scene Pacing Engine
 * Determines temporal cadence, beat intervals, transition frequencies,
 * and information density targets across 7 distinct pacing profiles.
 */

import { ScenePacingProfile, PacingProfileType } from "./models";
import { ContentDomain } from "../visual-intelligence/models";

export class PacingEngine {
  /**
   * Resolves appropriate pacing profile by name.
   */
  public static getProfile(name: PacingProfileType): ScenePacingProfile {
    switch (name) {
      case "CALM":
        return {
          name: "CALM",
          averageBeatDurationSeconds: 4.0,
          transitionFrequency: "LOW",
          informationDensityTarget: "LOW",
          cameraMotionFrequency: "LOW",
          emphasisFrequency: "LOW"
        };

      case "CINEMATIC":
        return {
          name: "CINEMATIC",
          averageBeatDurationSeconds: 3.5,
          transitionFrequency: "LOW",
          informationDensityTarget: "BALANCED",
          cameraMotionFrequency: "LOW",
          emphasisFrequency: "BALANCED"
        };

      case "FAST":
        return {
          name: "FAST",
          averageBeatDurationSeconds: 1.5,
          transitionFrequency: "HIGH",
          informationDensityTarget: "HIGH",
          cameraMotionFrequency: "HIGH",
          emphasisFrequency: "HIGH"
        };

      case "ENERGETIC":
        return {
          name: "ENERGETIC",
          averageBeatDurationSeconds: 2.0,
          transitionFrequency: "HIGH",
          informationDensityTarget: "HIGH",
          cameraMotionFrequency: "HIGH",
          emphasisFrequency: "HIGH"
        };

      case "DRAMATIC":
        return {
          name: "DRAMATIC",
          averageBeatDurationSeconds: 3.0,
          transitionFrequency: "BALANCED",
          informationDensityTarget: "HIGH",
          cameraMotionFrequency: "BALANCED",
          emphasisFrequency: "HIGH"
        };

      case "PLAYFUL":
        return {
          name: "PLAYFUL",
          averageBeatDurationSeconds: 2.5,
          transitionFrequency: "HIGH",
          informationDensityTarget: "BALANCED",
          cameraMotionFrequency: "BALANCED",
          emphasisFrequency: "BALANCED"
        };

      case "INFORMATIVE":
      default:
        return {
          name: "INFORMATIVE",
          averageBeatDurationSeconds: 3.0,
          transitionFrequency: "BALANCED",
          informationDensityTarget: "BALANCED",
          cameraMotionFrequency: "BALANCED",
          emphasisFrequency: "BALANCED"
        };
    }
  }

  /**
   * Resolves default pacing profile for a given Content Domain.
   */
  public static resolveProfileForDomain(domain: ContentDomain | string): ScenePacingProfile {
    switch ((domain || "GENERAL").toUpperCase()) {
      case "FINANCE":
        return this.getProfile("INFORMATIVE");
      case "HISTORY":
        return this.getProfile("CINEMATIC");
      case "DOCUMENTARY":
        return this.getProfile("CALM");
      case "KIDS":
        return this.getProfile("PLAYFUL");
      case "GENERAL":
      default:
        return this.getProfile("INFORMATIVE");
    }
  }
}
