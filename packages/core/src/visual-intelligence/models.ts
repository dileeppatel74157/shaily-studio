/**
 * Visual Intelligence & Style Planning Models
 * Defines the generic visual language, domain classification, and structured visual planning
 * across multiple production workloads (Finance, History, Documentary, Kids, General).
 */

import {
  SceneVisualLayer,
  SceneCharacter,
  CameraMotion,
  AnimationInstruction,
  AnimationActionPreset,
  AnimationKeyframe
} from "../animation/models";

export type ContentDomain =
  | "FINANCE"
  | "HISTORY"
  | "DOCUMENTARY"
  | "KIDS"
  | "GENERAL";

export interface DomainClassificationResult {
  domain: ContentDomain;
  confidence: number;
  detectedSubtopics: string[];
  reasoning?: string;
}

export type ChartType = "LINE" | "BAR" | "PIE" | "DONUT" | "AREA" | "CANDLESTICK";

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface DataVisualizationSpec {
  id: string;
  type: "CHART" | "COUNTER" | "INDICATOR" | "TIMELINE" | "MAP" | "STATISTIC_CALLOUT" | "COMPARISON_CARD" | "DIAGRAM";
  chartType?: ChartType;
  title?: string;
  subtitle?: string;
  unit?: string;
  data?: ChartDataPoint[] | Record<string, any>;
  animation?: "DRAW" | "COUNT_UP" | "REVEAL" | "PULSE" | "FADE_IN" | "NONE";
  position?: { x: number; y: number; width?: number; height?: number };
}

export interface OverlaySpec {
  id: string;
  type: "LOWER_THIRD" | "BADGE" | "CALLOUT" | "HEADLINE" | "SUBTITLE" | "INFOGRAPHIC_CARD";
  text: string;
  subtext?: string;
  icon?: string;
  position?: "TOP_LEFT" | "TOP_RIGHT" | "BOTTOM_LEFT" | "BOTTOM_RIGHT" | "CENTER" | "LOWER_THIRD";
  animation?: "FADE_IN" | "SLIDE_UP" | "ZOOM_IN" | "POP";
}

export interface AssetStrategySpec {
  primaryVisualType: "GENERATED_IMAGE" | "CARTOON_SPRITE" | "INFOGRAPHIC" | "MAP" | "ARCHIVAL" | "PHOTOGRAPHIC" | "DATA_VISUALIZATION";
  backgroundAssetType: "COLORFUL_LANDSCAPE" | "ABSTRACT_GRADIENT" | "PERIOD_ENVIRONMENT" | "REALISTIC_B_ROLL" | "MINIMAL_STUDIO";
  characterStrategy: "PERSISTENT_AVATAR" | "NONE" | "HISTORICAL_FIGURE" | "EXPLAINER_HOST";
  allowFallbackGenerators: boolean;
}

export interface VisualStylePlan {
  domain: ContentDomain;
  visualStyle: string;
  tone: "PLAYFUL" | "AUTHORITATIVE" | "CINEMATIC" | "EDUCATIONAL" | "DRAMATIC" | "SERIOUS";
  colorDirection: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    paletteName: string;
  };
  typographyStyle: {
    fontFamily: string;
    headingWeight: string;
    captionStyle: "CLEAN_SANS" | "PLAYFUL_ROUNDED" | "CLASSIC_SERIF" | "MONOSPACE";
  };
  cameraStyle: {
    preferredMotion: "ZOOM_IN" | "ZOOM_OUT" | "PAN_LEFT" | "PAN_RIGHT" | "KEN_BURNS" | "STATIC";
    intensity: number;
    allowDynamicShake: boolean;
  };
  motionIntensity: "SUBTLE" | "BALANCED" | "ENERGETIC";
  transitionStyle: "CUT" | "FADE" | "SLIDE" | "ZOOM" | "WIPE";
  assetStrategy: AssetStrategySpec;
  characterStrategy?: {
    enabled: boolean;
    requiredCharacterIds?: string[];
    styleType?: "CARTOON_2D" | "HOST_AVATAR" | "ILLUSTRATION" | "NONE";
  };
  backgroundStrategy: {
    style: "CARTOON" | "DATA_GRID" | "MAP_TEXTURE" | "PHOTO_CINEMATIC" | "MINIMAL";
    parallaxEnabled: boolean;
  };
  overlayStrategy: {
    enabled: boolean;
    badgeStyle: string;
    dataCalloutsEnabled: boolean;
  };
  dataVisualizationStrategy: {
    enabled: boolean;
    preferredChartTypes: ChartType[];
    useNumberCounters: boolean;
  };
  narrationStyle: {
    voicePersona: string;
    pace: "FAST" | "MODERATE" | "MEASURED";
    mood: "ENTHUSIASTIC" | "CALM_AUTHORITATIVE" | "STORYTELLER" | "CASUAL";
  };
}

import { VisualPrimitive } from "../visual-primitives/models";

export interface SceneVisualPlan {
  purpose: string;
  visualObjective: string;
  layers: SceneVisualLayer[];
  cameraMotion: CameraMotion;
  animationInstructions: AnimationInstruction[];
  overlays: OverlaySpec[];
  dataVisualizations: DataVisualizationSpec[];
  dominantVisualType: "IMAGE" | "CHARACTER" | "CHART" | "MAP" | "INFOGRAPHIC" | "DIAGRAM";
  visualPrimitives?: VisualPrimitive[];
}

