import { MediaProviderState } from "./MediaProviderState";
import { MediaProviderType } from "./MediaProviderType";
import { MediaType } from "./MediaType";
import { GenerationMode } from "./GenerationMode";
import { MediaQuality } from "./MediaQuality";
import { ProcessingState } from "./ProcessingState";
import { MediaEventType } from "./MediaEventType";
import { MediaValidationResult } from "./MediaValidationResult";

export interface MediaRequest {
  id: string;
  provider?: MediaProviderType;
  mode: GenerationMode;
  prompt: string;
  quality?: MediaQuality;
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
}

export interface MediaResponse {
  id: string;
  requestId: string;
  provider: MediaProviderType;
  assets: MediaAsset[];
  durationMs: number;
  costUSD?: number;
  error?: string;
}

export interface ImageGenerationRequest extends MediaRequest {
  negativePrompt?: string;
  aspectRatio?: string;     // e.g. "16:9", "1:1"
  size?: string;            // e.g. "1024x1024"
  numImages?: number;
  seed?: number;
}

export interface VideoGenerationRequest extends MediaRequest {
  negativePrompt?: string;
  durationSeconds?: number;
  fps?: number;
  aspectRatio?: string;
  resolution?: string;       // e.g. "1080p", "4k"
  inputImage?: string;       // Image-to-video source URL/base64
  seed?: number;
}

export interface SpeechRequest {
  id: string;
  provider?: MediaProviderType;
  text: string;
  voiceId: string;
  languageCode?: string;     // e.g. "en-US"
  speed?: number;            // 0.25 to 4.0
  pitch?: number;            // 0.5 to 2.0
  stream?: boolean;
}

export interface SpeechResponse {
  id: string;
  requestId: string;
  provider: MediaProviderType;
  audioUrl: string;
  durationSeconds: number;
  charCount: number;
}

export interface MusicRequest extends MediaRequest {
  durationSeconds?: number;
  tempoBpm?: number;
  genre?: string;
  instrumental?: boolean;
}

export interface SfxRequest extends MediaRequest {
  durationSeconds?: number;
}

export interface SubtitleRequest {
  id: string;
  audioUrl: string;
  format: "srt" | "vtt" | "json";
  languageCode?: string;
}

export interface SubtitleResponse {
  id: string;
  requestId: string;
  provider: MediaProviderType;
  subtitleUrl: string;
  content: string;
}

export interface UpscaleRequest {
  id: string;
  provider?: MediaProviderType;
  assetUrl: string;
  scaleFactor: number;       // e.g. 2, 4
  type: "image" | "video";
}

export interface MediaAsset {
  id: string;
  type: MediaType;
  url: string;
  sizeBytes?: number;
  mimeType?: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  metadata?: Record<string, unknown>;
}

export interface GenerationProgress {
  jobId: string;
  status: ProcessingState;
  percentComplete: number;
  etaSeconds?: number;
  errorMessage?: string;
}

export interface GenerationJob {
  id: string;
  provider: MediaProviderType;
  type: MediaType;
  mode: GenerationMode;
  state: ProcessingState;
  progress: number;
  createdAt: Date;
  completedAt?: Date;
  assets?: MediaAsset[];
  error?: string;
}

export interface MediaUsage {
  totalRequests: number;
  imagesGenerated: number;
  videosGenerated: number;
  audioSecondsGenerated: number;
  totalCostUSD: number;
}

export interface ProviderCapability {
  provider: MediaProviderType;
  supportedTypes: MediaType[];
  supportedModes: GenerationMode[];
  supportedQualities: MediaQuality[];
  supportsStreaming: boolean;
  maxDurationSeconds?: number;
}

export interface ProviderStatistics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  assetsGenerated: number;
  totalDurationSeconds: number;
  totalCostUSD: number;
  averageLatencyMs: number;
  activeJobsCount: number;
}

export interface FallbackConfig {
  fallbackProviders: MediaProviderType[];
  triggerOnStatusCodes?: number[];
  maxAttempts?: number;
}

export interface ProviderConfiguration {
  provider: MediaProviderType;
  apiKey?: string;
  endpoint?: string;
  capabilities: ProviderCapability;
  fallbackConfig?: FallbackConfig;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface ProviderRegistration {
  id: string;
  type: MediaProviderType;
  state: MediaProviderState;
  health: ProviderHealth;
  config: ProviderConfiguration;
  lastActive?: Date;
  error?: string;
}

export enum ProviderHealth {
  HEALTHY = "HEALTHY",
  DEGRADED = "DEGRADED",
  UNHEALTHY = "UNHEALTHY",
  UNKNOWN = "UNKNOWN"
}

export interface ValidationIssue {
  rule: string;
  severity: "ERROR" | "WARNING";
  message: string;
  context?: any;
}

export interface MediaValidationReport {
  timestamp: Date;
  valid: boolean;
  issues: ValidationIssue[];
}

export interface MediaEvent {
  type: MediaEventType;
  timestamp: Date;
  payload?: any;
}

export interface MediaSnapshot {
  timestamp: Date;
  state: MediaProviderState;
  providers: ProviderRegistration[];
  statistics: Record<string, ProviderStatistics>;
  globalUsage: MediaUsage;
  activeJobs: GenerationJob[];
  metadata?: Record<string, unknown>;
}
