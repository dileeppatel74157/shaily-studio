/**
 * Intelligent Scene Composition & Story Direction Domain Models
 * Domain-agnostic semantic production models for Shaily Studio Video OS.
 * Serves FINANCE, HISTORY, DOCUMENTARY, KIDS, GENERAL and future domains.
 */

import { VisualPrimitive } from "../visual-primitives/models";
import { CameraMotion, AnimationInstruction } from "../animation/models";
import { ContentDomain } from "../visual-intelligence/models";

export type SceneBeatType =
  | "INTRO"
  | "EXPLANATION"
  | "DEMONSTRATION"
  | "COMPARISON"
  | "STATISTIC"
  | "TIMELINE_EVENT"
  | "MAP_REVEAL"
  | "CHARACTER_ACTION"
  | "DIALOGUE"
  | "EMPHASIS"
  | "TRANSITION"
  | "SUMMARY"
  | "OUTRO";

export type FocusType =
  | "OBJECT"
  | "CHARACTER"
  | "TEXT"
  | "CHART"
  | "NUMBER"
  | "MAP"
  | "IMAGE"
  | "CALLOUT"
  | "FULL_SCENE";

export type PacingProfileType =
  | "CALM"
  | "INFORMATIVE"
  | "CINEMATIC"
  | "FAST"
  | "ENERGETIC"
  | "DRAMATIC"
  | "PLAYFUL";

export type SemanticTransitionType =
  | "CUT"
  | "FADE"
  | "DISSOLVE"
  | "SLIDE"
  | "ZOOM"
  | "MATCH_CUT"
  | "WIPE"
  | "MORPH"
  | "NONE";

export type HierarchyLevel =
  | "PRIMARY"
  | "SECONDARY"
  | "SUPPORTING"
  | "BACKGROUND";

export interface FocusTarget {
  id: string;
  type: FocusType;
  targetId?: string; // ID of the visual element or primitive
  enterOffsetSeconds: number;
  holdDurationSeconds: number;
  exitOffsetSeconds: number;
  visualProminence: number; // 0.0 to 1.0
  scaleMultiplier?: number;
  framingAnchor?: { x: number; y: number };
}

export interface SceneBeat {
  id: string;
  type: SceneBeatType;
  startTimeSeconds: number;
  durationSeconds: number;
  purpose: string;
  narrationReference?: string;
  visualObjective: string;
  focusTarget?: FocusTarget;
  requiredAssets?: string[];
  primitives?: VisualPrimitive[];
  animation?: AnimationInstruction;
  camera?: CameraMotion;
  audioRelationship?: {
    duckMusic: boolean;
    playSfxCue?: string;
    speechSync: boolean;
  };
}

export interface CompositionLayer {
  id: string;
  name: string;
  hierarchyLevel: HierarchyLevel;
  zIndex: number;
  primitive?: VisualPrimitive;
  assetUrl?: string;
  startTimeSeconds: number;
  durationSeconds: number;
  enterTransition?: SemanticTransitionType;
  exitTransition?: SemanticTransitionType;
  opacity?: number;
  scale?: number;
}

export interface SceneTimingCue {
  id: string;
  timestampSeconds: number;
  label: string;
  action: string;
  targetElementId?: string;
}

export interface SceneTimingMap {
  totalDurationSeconds: number;
  cues: SceneTimingCue[];
  narrationSyncPoints: Array<{
    speechOffsetSeconds: number;
    speechTextSnippet: string;
    visualEventId: string;
  }>;
}

export interface SceneContinuityState {
  sceneId: string;
  sceneNumber: number;
  persistentCharacters: Array<{
    characterId: string;
    name: string;
    lastPosition: { x: number; y: number };
    currentPose: string;
    expression: string;
  }>;
  environmentIdentity: {
    theme: string;
    backgroundStyle: string;
    primaryColor: string;
  };
  activeVisualMotifs: string[];
  cameraContext: {
    lastFraming: string;
    lastFocalPoint?: { x: number; y: number };
  };
  narrativeState: {
    storyProgressRatio: number; // 0.0 to 1.0
    keyTakeawayCount: number;
  };
}

export interface ScenePacingProfile {
  name: PacingProfileType;
  averageBeatDurationSeconds: number;
  transitionFrequency: "LOW" | "BALANCED" | "HIGH";
  informationDensityTarget: "LOW" | "BALANCED" | "HIGH";
  cameraMotionFrequency: "LOW" | "BALANCED" | "HIGH";
  emphasisFrequency: "LOW" | "BALANCED" | "HIGH";
}

export interface SceneInformationHierarchy {
  primaryElements: string[];
  secondaryElements: string[];
  supportingElements: string[];
  backgroundElements: string[];
  visualComplexityScore: number;
  textDensityScore: number;
  motionDensityScore: number;
  audioDensityScore: number;
  totalComplexityScore: number;
  isOverloaded: boolean;
  simplificationsApplied: string[];
}

export interface SceneTransition {
  type: SemanticTransitionType;
  durationSeconds: number;
  direction?: "LEFT" | "RIGHT" | "UP" | "DOWN" | "IN" | "OUT";
  easing?: string;
}

export interface SceneDirection {
  focalPoint: { x: number; y: number };
  motionPreset: string;
  intensity: number;
  panningVector?: { dx: number; dy: number };
}

export interface SceneCompositionPlan {
  sceneId: string;
  sceneNumber: number;
  domain: ContentDomain;
  durationSeconds: number;
  objective: string;
  narrativePurpose: string;
  beats: SceneBeat[];
  visualLayers: CompositionLayer[];
  focusTargets: FocusTarget[];
  timingMap: SceneTimingMap;
  pacing: ScenePacingProfile;
  cameraDirection: SceneDirection;
  transition: SceneTransition;
  continuity: SceneContinuityState;
  informationHierarchy: SceneInformationHierarchy;
  confidence: number;
}
