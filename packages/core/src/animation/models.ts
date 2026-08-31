/**
 * 2D Programmatic Animation Data Model
 * Provides deterministic keyframe and action preset primitives for multi-layer cartoon/kids animation.
 */

export type EasingType =
  | "linear"
  | "easeIn"
  | "easeOut"
  | "easeInOut"
  | "bounce"
  | "elastic"
  | "step";

export interface AnimationKeyframe {
  /** Time in seconds relative to scene start */
  timeSeconds: number;
  /** Horizontal position (pixels or fraction 0.0-1.0 or expression) */
  x?: number;
  /** Vertical position (pixels or fraction 0.0-1.0 or expression) */
  y?: number;
  /** Scale factor (1.0 = normal size) */
  scale?: number;
  /** Rotation in degrees (e.g. -15 to 15) */
  rotation?: number;
  /** Opacity (0.0 to 1.0) */
  opacity?: number;
  /** Easing curve to next keyframe */
  easing?: EasingType;
}

export type AnimationActionPreset =
  | "ENTER_LEFT"
  | "ENTER_RIGHT"
  | "ENTER_BOTTOM"
  | "ENTER_TOP"
  | "EXIT_LEFT"
  | "EXIT_RIGHT"
  | "EXIT_BOTTOM"
  | "EXIT_TOP"
  | "WALK"
  | "RUN"
  | "JUMP"
  | "BOUNCE"
  | "WAVE"
  | "FLOAT"
  | "SHAKE"
  | "PULSE"
  | "IDLE";

export type CameraMotionType =
  | "STATIC"
  | "ZOOM_IN"
  | "ZOOM_OUT"
  | "PAN_LEFT"
  | "PAN_RIGHT"
  | "PAN_UP"
  | "PAN_DOWN"
  | "TRACK_SUBJECT"
  | "CAMERA_SHAKE"
  | "KEN_BURNS";

export interface CameraMotion {
  type: CameraMotionType;
  intensity?: number;
  startScale?: number;
  endScale?: number;
  startX?: number;
  endX?: number;
  startY?: number;
  endY?: number;
  durationSeconds?: number;
}

export type LayerType = "BACKGROUND" | "MIDGROUND" | "CHARACTER" | "FOREGROUND" | "PROP";

export interface SceneVisualLayer {
  id: string;
  layerType: LayerType;
  assetUrl: string;
  characterId?: string;
  name?: string;
  parallaxRate?: number; // 0.2 for distant bg, 1.0 for midground/character, 1.5 for foreground
  initialPosition?: {
    x: number; // 0.0 - 1.0 (relative to canvas width)
    y: number; // 0.0 - 1.0 (relative to canvas height)
    width?: number; // relative width, e.g. 0.35 (35% of frame)
    height?: number; // relative height, e.g. 0.5 (50% of frame)
  };
  actionPreset?: AnimationActionPreset;
  movement?: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  };
  keyframes?: AnimationKeyframe[];
  opacity?: number;
  zIndex: number;
}

export interface SceneCharacter {
  id: string;
  name: string;
  description: string;
  assetUrl: string;
  primaryColor?: string;
}

export interface AnimationInstruction {
  characterId: string;
  action: AnimationActionPreset;
  movement?: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  };
  keyframes?: AnimationKeyframe[];
  camera?: CameraMotion;
}
