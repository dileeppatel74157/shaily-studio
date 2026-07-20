import { ContentStage } from "./ContentStage";
import { AssetType } from "./AssetType";
import { AssetStatus } from "./AssetStatus";
import { CompositionState } from "./CompositionState";
import { RenderQuality } from "./RenderQuality";
import { ContentPipelineState } from "./ContentPipelineState";

export interface CameraMovement {
  angle: string;
  pan: string;
  zoom: string;
  focus: string;
}

export interface Shot {
  id: string;
  shotNumber: number;
  description: string;
  camera: CameraMovement;
  durationSeconds: number;
  visualPrompt: string;
}

export interface Scene {
  id: string;
  sceneNumber: number;
  title: string;
  scriptText: string;
  durationSeconds: number;
  shots: Shot[];
  transition: string;
  overlayText?: string;
  captions?: string;
}

export interface Storyboard {
  id: string;
  projectId: string;
  scriptId: string;
  scenes: Scene[];
  totalScenes: number;
  totalDurationSeconds: number;
  createdAt: Date;
}

export interface VoiceSegment {
  id: string;
  sceneId: string;
  text: string;
  audioUrl: string;
  durationSeconds: number;
  speakerId: string;
  startOffsetSeconds: number;
}

export interface Subtitle {
  id: string;
  text: string;
  startOffsetMs: number;
  endOffsetMs: number;
  sceneId: string;
}

export interface MusicTrack {
  id: string;
  title: string;
  audioUrl: string;
  durationSeconds: number;
  volume: number;
  loop: boolean;
}

export interface SoundEffect {
  id: string;
  name: string;
  audioUrl: string;
  durationSeconds: number;
  triggerOffsetSeconds: number;
  sceneId: string;
}

export interface VideoSegment {
  id: string;
  sceneId: string;
  shotId: string;
  videoUrl: string;
  durationSeconds: number;
  fps: number;
  resolution: string;
}

export interface AssetReference {
  id: string;
  type: AssetType;
  url: string;
  status: AssetStatus;
  meta?: Record<string, any>;
}

export interface TimelineTrack {
  id: string;
  name: string;
  type: AssetType;
  assets: AssetReference[];
}

export interface CompositionTimeline {
  id: string;
  tracks: TimelineTrack[];
  durationSeconds: number;
  resolution: string;
  fps: number;
  state: CompositionState;
}

export interface GeneratedAsset {
  id: string;
  type: AssetType;
  url: string;
  status: AssetStatus;
  createdAt: Date;
  sizeBytes: number;
  durationSeconds?: number;
}

export interface PipelineMetrics {
  stageDurationsMs: Record<ContentStage, number>;
  totalDurationMs: number;
  costUsd: number;
  promptTokens: number;
  completionTokens: number;
  assetsGeneratedCount: number;
}

export interface RenderReport {
  id: string;
  quality: RenderQuality;
  resolution: string;
  fps: number;
  sizeBytes: number;
  durationSeconds: number;
  renderedFileUrl: string;
  timestamp: Date;
}

export interface QualityReport {
  id: string;
  passed: boolean;
  missingAssets: string[];
  badSubtitles: string[];
  durationMismatch: boolean;
  narrationMismatch: boolean;
  warnings: string[];
  timestamp: Date;
}

export interface ThumbnailPackage {
  id: string;
  thumbnailUrl: string;
  variants: string[];
  width: number;
  height: number;
}

export interface PublishingPackage {
  id: string;
  projectId: string;
  videoFileUrl: string;
  thumbnail: ThumbnailPackage;
  title: string;
  description: string;
  tags: string[];
  captionsSrtUrl: string;
  metadata: Record<string, any>;
  analyticsSeed: Record<string, any>;
  timestamp: Date;
}

export interface ContentPipelineStatistics {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageRunDurationMs: number;
  totalCostUsd: number;
  totalAssetsGenerated: number;
}

export interface ExecutionSnapshot {
  pipelineId: string;
  state: ContentPipelineState;
  currentStage: ContentStage;
  progressPercent: number;
  metrics: PipelineMetrics;
  timestamp: Date;
}

export interface ValidationIssue {
  rule: string;
  message: string;
  severity: "WARNING" | "CRITICAL";
}

export interface ContentValidationReport {
  valid: boolean;
  issues: ValidationIssue[];
  timestamp: Date;
}
