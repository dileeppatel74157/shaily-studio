/**
 * Universal Visual Primitive Data Models
 * Domain-agnostic visual primitive abstractions for Shaily Studio Video OS.
 * Serves FINANCE, HISTORY, DOCUMENTARY, KIDS, and GENERAL video workloads.
 */

import { EasingType } from "../animation/models";

export type VisualPrimitiveType =
  | "TEXT"
  | "IMAGE"
  | "SHAPE"
  | "LINE_CHART"
  | "BAR_CHART"
  | "AREA_CHART"
  | "DONUT_CHART"
  | "NUMBER_COUNTER"
  | "PERCENTAGE_INDICATOR"
  | "TIMELINE"
  | "STAT_CARD"
  | "LOWER_THIRD"
  | "INFO_CARD"
  | "CALLOUT"
  | "CHARACTER"
  | "CAMERA";

export type PrimitiveAnimationBehavior =
  | "FADE_IN"
  | "FADE_OUT"
  | "SLIDE_LEFT"
  | "SLIDE_RIGHT"
  | "SLIDE_UP"
  | "SLIDE_DOWN"
  | "SCALE_IN"
  | "SCALE_OUT"
  | "REVEAL"
  | "DRAW"
  | "COUNT_UP"
  | "HIGHLIGHT"
  | "PULSE"
  | "WALK"
  | "RUN"
  | "JUMP"
  | "BOUNCE"
  | "WAVE"
  | "FLOAT"
  | "SHAKE"
  | "ENTER_LEFT"
  | "ENTER_RIGHT"
  | "EXIT_LEFT"
  | "EXIT_RIGHT"
  | "IDLE"
  | "NONE";


export interface NormalizedPosition {
  /** Horizontal anchor / center (0.0 to 1.0) */
  x: number;
  /** Vertical anchor / center (0.0 to 1.0) */
  y: number;
  /** Width relative to canvas (0.0 to 1.0) */
  width?: number;
  /** Height relative to canvas (0.0 to 1.0) */
  height?: number;
}

export interface PixelDimensions {
  width: number;
  height: number;
}

export interface VisualPrimitiveStyle {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: "normal" | "bold" | "600" | "800";
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  boxShadow?: string;
  padding?: number;
  opacity?: number;
  gradient?: {
    from: string;
    to: string;
    angle?: number;
  };
}

export interface VisualPrimitiveAnimation {
  behavior: PrimitiveAnimationBehavior;
  durationSeconds?: number;
  delaySeconds?: number;
  easing?: EasingType;
  startProgress?: number;
  endProgress?: number;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
  secondaryValue?: number;
}

export interface ChartPrimitiveData {
  title?: string;
  subtitle?: string;
  unit?: string;
  dataPoints: ChartDataPoint[];
  showLegend?: boolean;
  showGrid?: boolean;
  showValues?: boolean;
  minY?: number;
  maxY?: number;
}

export interface TimelineMilestone {
  dateOrEra: string;
  title: string;
  description?: string;
  color?: string;
  isHighlighted?: boolean;
}

export interface TimelinePrimitiveData {
  title?: string;
  milestones: TimelineMilestone[];
  activeMilestoneIndex?: number;
}

export interface StatCardPrimitiveData {
  badgeText?: string;
  value: string | number;
  label: string;
  deltaText?: string;
  deltaIsPositive?: boolean;
  icon?: string;
  subtext?: string;
}

export interface NumberCounterPrimitiveData {
  startValue: number;
  targetValue: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  label?: string;
}

export interface PercentageIndicatorPrimitiveData {
  percentage: number; // 0 to 100
  label?: string;
  subtext?: string;
  ringThickness?: number;
}

export interface LowerThirdPrimitiveData {
  headline: string;
  subheadline?: string;
  categoryBadge?: string;
  accentColor?: string;
}

export interface InfoCardPrimitiveData {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
}

export interface CalloutPrimitiveData {
  header: string;
  detail: string;
  targetPoint?: { x: number; y: number };
}

export interface CharacterPrimitiveData {
  characterId: string;
  characterName: string;
  assetUrl?: string;
  expression?: string;
  actionPreset?: string;
}

export interface CameraPrimitiveData {
  motionType: "STATIC" | "ZOOM_IN" | "ZOOM_OUT" | "PAN_LEFT" | "PAN_RIGHT" | "PAN_UP" | "PAN_DOWN" | "KEN_BURNS" | "CAMERA_SHAKE";
  intensity?: number;
  durationSeconds?: number;
}

export interface VisualPrimitive<T = Record<string, any>> {
  id: string;
  type: VisualPrimitiveType;
  position: NormalizedPosition;
  dimensions?: PixelDimensions;
  startTime: number;      // in seconds relative to scene
  duration: number;       // in seconds
  zIndex: number;
  opacity: number;
  style: VisualPrimitiveStyle;
  animation?: VisualPrimitiveAnimation;
  metadata?: T;
}

export interface ScenePrimitiveComposition {
  sceneId: string;
  durationSeconds: number;
  canvasWidth: number;
  canvasHeight: number;
  primitives: VisualPrimitive[];
}
