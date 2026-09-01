/**
 * Universal Audio Intelligence & Production Domain Models
 * Domain-agnostic audio management for Shaily Studio Video OS.
 * Serves FINANCE, HISTORY, DOCUMENTARY, KIDS, GENERAL and future domains.
 */

import { AssetKind, AssetOrigin, AssetLifecycle, IntelligentAsset } from "../asset-intelligence/models";

export type AudioKind =
  | "NARRATION"
  | "DIALOGUE"
  | "MUSIC"
  | "AMBIENCE"
  | "SFX"
  | "TRANSITION"
  | "OTHER";

export interface AudioAsset extends IntelligentAsset {
  audioKind: AudioKind;
  sampleRate?: number;    // e.g. 48000, 44100, 24000
  channels?: number;      // 1 (mono), 2 (stereo)
  bitrate?: number;       // kbps
  codec?: string;         // "pcm_s16le", "aac", "mp3"
  loudnessLufs?: number;  // Integrated LUFS (e.g. -16.0)
  peakDb?: number;        // True peak in dB (e.g. -1.5)
}

export interface NarrationSegmentSpec {
  id: string;
  sceneId: string;
  text: string;
  speakerId: string;
  voiceId: string;
  language?: string;
  emotion?: string;
  expectedDurationSeconds?: number;
  actualDurationSeconds?: number;
  startOffsetSeconds?: number;
  pauseBeforeSeconds?: number;
  pauseAfterSeconds?: number;
  audioUrl?: string;
  filePath?: string;
}

export interface NarrationPlan {
  projectId: string;
  voicePersona: string;
  segments: NarrationSegmentSpec[];
  totalExpectedDurationSeconds: number;
}

export interface MusicPlanSpec {
  id: string;
  title: string;
  prompt: string;
  genreStyle: string;
  mood: string;
  intensity: "SUBTLE" | "BALANCED" | "ENERGETIC" | "EPIC";
  targetDurationSeconds: number;
  volume: number;
  loop: boolean;
  fadeInSeconds?: number;
  fadeOutSeconds?: number;
  audioUrl?: string;
  filePath?: string;
}

export interface SFXCueSpec {
  id: string;
  sceneId: string;
  semanticCue: string; // e.g. "WHOOSH", "POP", "CLICK", "IMPACT", "SWOOSH", "TRANSITION", "NOTIFICATION"
  prompt: string;
  triggerOffsetSeconds: number;
  durationSeconds: number;
  volume: number;
  audioUrl?: string;
  filePath?: string;
}

export interface AudioSegment {
  id: string;
  kind: AudioKind;
  filePath: string;
  publicUrl: string;
  startTimeSeconds: number;
  durationSeconds: number;
  volume: number;
  fadeInSeconds?: number;
  fadeOutSeconds?: number;
  duckWithNarration?: boolean;
  duckVolume?: number;
  metadata?: Record<string, any>;
}

export interface AudioTrack {
  id: string;
  name: string;
  kind: AudioKind;
  segments: AudioSegment[];
  volume: number;
  isMuted?: boolean;
}

export interface AudioTimeline {
  id: string;
  tracks: AudioTrack[];
  totalDurationSeconds: number;
  sampleRate: number;
  channels: number;
  isMastered?: boolean;
}

export interface AudioDuckingConfig {
  enabled: boolean;
  duckRatio: number;     // Volume multiplier during narration (e.g. 0.25 -> 0.08)
  attackTimeMs: number;  // Fade down duration in ms (e.g. 150ms)
  releaseTimeMs: number; // Fade up duration in ms (e.g. 300ms)
}

export interface AudioMixPlan {
  timeline: AudioTimeline;
  ducking: AudioDuckingConfig;
  targetLoudnessLufs: number; // Standard: -16.0 LUFS for podcast/video web delivery
  targetTruePeakDb: number;   // Standard: -1.5 dBTP
}

export interface AudioMasterReport {
  id: string;
  masterFilePath: string;
  masterFileUrl: string;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  sizeBytes: number;
  integratedLoudnessLufs: number;
  truePeakDb: number;
  clippingDetected: boolean;
  timestamp: Date;
}
