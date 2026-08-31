/**
 * Visual Style Planner
 * Generates rich, domain-tailored VisualStylePlan instances for video projects.
 */

import {
  ContentDomain,
  DomainClassificationResult,
  VisualStylePlan
} from "./models";

export class VisualStylePlanner {
  /**
   * Generates a comprehensive VisualStylePlan based on the domain result and prompt details.
   */
  public static plan(classification: DomainClassificationResult, prompt: string): VisualStylePlan {
    const domain = classification.domain;

    switch (domain) {
      case "FINANCE":
        return this.planFinance(classification, prompt);
      case "HISTORY":
        return this.planHistory(classification, prompt);
      case "DOCUMENTARY":
        return this.planDocumentary(classification, prompt);
      case "KIDS":
        return this.planKids(classification, prompt);
      case "GENERAL":
      default:
        return this.planGeneral(classification, prompt);
    }
  }

  private static planFinance(classification: DomainClassificationResult, _prompt: string): VisualStylePlan {
    return {
      domain: "FINANCE",
      visualStyle: "EDITORIAL_INFOGRAPHIC",
      tone: "AUTHORITATIVE",
      colorDirection: {
        primary: "#0A192F",     // Deep Navy
        secondary: "#1E3A8A",   // Slate Blue
        accent: "#10B981",      // Emerald Green (growth/money)
        background: "#020617",  // Dark Slate Canvas
        text: "#F8FAFC",        // Crisp White
        paletteName: "WallStreet_Midnight"
      },
      typographyStyle: {
        fontFamily: "Inter, system-ui, sans-serif",
        headingWeight: "700",
        captionStyle: "CLEAN_SANS"
      },
      cameraStyle: {
        preferredMotion: "ZOOM_IN",
        intensity: 0.15,
        allowDynamicShake: false
      },
      motionIntensity: "SUBTLE",
      transitionStyle: "CUT",
      assetStrategy: {
        primaryVisualType: "INFOGRAPHIC",
        backgroundAssetType: "ABSTRACT_GRADIENT",
        characterStrategy: "NONE",
        allowFallbackGenerators: true
      },
      characterStrategy: {
        enabled: false
      },
      backgroundStrategy: {
        style: "DATA_GRID",
        parallaxEnabled: false
      },
      overlayStrategy: {
        enabled: true,
        badgeStyle: "METRIC_PILL",
        dataCalloutsEnabled: true
      },
      dataVisualizationStrategy: {
        enabled: true,
        preferredChartTypes: ["LINE", "BAR", "AREA"],
        useNumberCounters: true
      },
      narrationStyle: {
        voicePersona: "Financial Analyst",
        pace: "MEASURED",
        mood: "CALM_AUTHORITATIVE"
      }
    };
  }

  private static planHistory(classification: DomainClassificationResult, _prompt: string): VisualStylePlan {
    return {
      domain: "HISTORY",
      visualStyle: "ARCHIVAL_DOCUMENTARY",
      tone: "DRAMATIC",
      colorDirection: {
        primary: "#3E2723",     // Deep Earth Brown
        secondary: "#795548",   // Warm Clay
        accent: "#D4AF37",      // Antique Gold
        background: "#1A0F0A",  // Deep Parchment Dark
        text: "#FFF8E1",        // Warm Cream
        paletteName: "Imperial_Antiquity"
      },
      typographyStyle: {
        fontFamily: "Cinzel, Merriweather, Georgia, serif",
        headingWeight: "700",
        captionStyle: "CLASSIC_SERIF"
      },
      cameraStyle: {
        preferredMotion: "PAN_RIGHT",
        intensity: 0.2,
        allowDynamicShake: false
      },
      motionIntensity: "BALANCED",
      transitionStyle: "FADE",
      assetStrategy: {
        primaryVisualType: "ARCHIVAL",
        backgroundAssetType: "PERIOD_ENVIRONMENT",
        characterStrategy: "HISTORICAL_FIGURE",
        allowFallbackGenerators: true
      },
      characterStrategy: {
        enabled: false,
        styleType: "ILLUSTRATION"
      },
      backgroundStrategy: {
        style: "MAP_TEXTURE",
        parallaxEnabled: true
      },
      overlayStrategy: {
        enabled: true,
        badgeStyle: "CHRONOLOGY_TAG",
        dataCalloutsEnabled: true
      },
      dataVisualizationStrategy: {
        enabled: true,
        preferredChartTypes: ["BAR"],
        useNumberCounters: false
      },
      narrationStyle: {
        voicePersona: "Historian Storyteller",
        pace: "MEASURED",
        mood: "STORYTELLER"
      }
    };
  }

  private static planDocumentary(classification: DomainClassificationResult, _prompt: string): VisualStylePlan {
    return {
      domain: "DOCUMENTARY",
      visualStyle: "CINEMATIC_EDITORIAL",
      tone: "CINEMATIC",
      colorDirection: {
        primary: "#0C4A6E",     // Oceanic Deep Blue
        secondary: "#0284C7",   // Sky Cyan
        accent: "#06B6D4",      // Cyan Glow
        background: "#082F49",  // Midnight Abyss
        text: "#F0F9FF",        // Pure Mist White
        paletteName: "Oceanic_Abyss"
      },
      typographyStyle: {
        fontFamily: "Helvetica Neue, Arial, sans-serif",
        headingWeight: "600",
        captionStyle: "CLEAN_SANS"
      },
      cameraStyle: {
        preferredMotion: "KEN_BURNS",
        intensity: 0.25,
        allowDynamicShake: false
      },
      motionIntensity: "BALANCED",
      transitionStyle: "FADE",
      assetStrategy: {
        primaryVisualType: "PHOTOGRAPHIC",
        backgroundAssetType: "REALISTIC_B_ROLL",
        characterStrategy: "NONE",
        allowFallbackGenerators: true
      },
      characterStrategy: {
        enabled: false
      },
      backgroundStrategy: {
        style: "PHOTO_CINEMATIC",
        parallaxEnabled: true
      },
      overlayStrategy: {
        enabled: true,
        badgeStyle: "SCIENTIFIC_LOWER_THIRD",
        dataCalloutsEnabled: true
      },
      dataVisualizationStrategy: {
        enabled: true,
        preferredChartTypes: ["LINE", "AREA"],
        useNumberCounters: true
      },
      narrationStyle: {
        voicePersona: "Documentary Narrator",
        pace: "MODERATE",
        mood: "CALM_AUTHORITATIVE"
      }
    };
  }

  private static planKids(classification: DomainClassificationResult, _prompt: string): VisualStylePlan {
    return {
      domain: "KIDS",
      visualStyle: "2D_CARTOON_ANIMATION",
      tone: "PLAYFUL",
      colorDirection: {
        primary: "#FFB703",     // Sunny Golden Yellow
        secondary: "#FB8500",   // Warm Orange
        accent: "#8ECAE6",      // Cheerful Sky Blue
        background: "#219EBC",  // Vibrant Teal
        text: "#FFFFFF",        // Pure White
        paletteName: "Sunny_Meadow_Adventure"
      },
      typographyStyle: {
        fontFamily: "Fredoka, Comic Sans MS, cursive, sans-serif",
        headingWeight: "800",
        captionStyle: "PLAYFUL_ROUNDED"
      },
      cameraStyle: {
        preferredMotion: "ZOOM_IN",
        intensity: 0.3,
        allowDynamicShake: true
      },
      motionIntensity: "ENERGETIC",
      transitionStyle: "ZOOM",
      assetStrategy: {
        primaryVisualType: "CARTOON_SPRITE",
        backgroundAssetType: "COLORFUL_LANDSCAPE",
        characterStrategy: "PERSISTENT_AVATAR",
        allowFallbackGenerators: true
      },
      characterStrategy: {
        enabled: true,
        requiredCharacterIds: ["char-leo"],
        styleType: "CARTOON_2D"
      },
      backgroundStrategy: {
        style: "CARTOON",
        parallaxEnabled: true
      },
      overlayStrategy: {
        enabled: true,
        badgeStyle: "FUN_SPEECH_BUBBLE",
        dataCalloutsEnabled: false
      },
      dataVisualizationStrategy: {
        enabled: false,
        preferredChartTypes: [],
        useNumberCounters: false
      },
      narrationStyle: {
        voicePersona: "Friendly Storyteller",
        pace: "MODERATE",
        mood: "ENTHUSIASTIC"
      }
    };
  }

  private static planGeneral(classification: DomainClassificationResult, _prompt: string): VisualStylePlan {
    return {
      domain: "GENERAL",
      visualStyle: "MODERN_EXPLAINER",
      tone: "EDUCATIONAL",
      colorDirection: {
        primary: "#1E293B",
        secondary: "#334155",
        accent: "#3B82F6",
        background: "#0F172A",
        text: "#F8FAFC",
        paletteName: "Modern_Tech"
      },
      typographyStyle: {
        fontFamily: "Inter, sans-serif",
        headingWeight: "600",
        captionStyle: "CLEAN_SANS"
      },
      cameraStyle: {
        preferredMotion: "ZOOM_IN",
        intensity: 0.2,
        allowDynamicShake: false
      },
      motionIntensity: "BALANCED",
      transitionStyle: "CUT",
      assetStrategy: {
        primaryVisualType: "GENERATED_IMAGE",
        backgroundAssetType: "MINIMAL_STUDIO",
        characterStrategy: "NONE",
        allowFallbackGenerators: true
      },
      characterStrategy: {
        enabled: false
      },
      backgroundStrategy: {
        style: "MINIMAL",
        parallaxEnabled: false
      },
      overlayStrategy: {
        enabled: true,
        badgeStyle: "CLEAN_CARD",
        dataCalloutsEnabled: true
      },
      dataVisualizationStrategy: {
        enabled: true,
        preferredChartTypes: ["BAR", "LINE"],
        useNumberCounters: true
      },
      narrationStyle: {
        voicePersona: "Explainer Host",
        pace: "MODERATE",
        mood: "CASUAL"
      }
    };
  }
}
