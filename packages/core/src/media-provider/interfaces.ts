import { MediaProviderState } from "./MediaProviderState";
import { MediaProviderType } from "./MediaProviderType";
import { MediaType } from "./MediaType";
import { MediaEventType } from "./MediaEventType";
import { ProviderHealth } from "./models";
import {
  MediaResponse,
  ImageGenerationRequest,
  VideoGenerationRequest,
  SpeechRequest,
  SpeechResponse,
  MusicRequest,
  SfxRequest,
  SubtitleRequest,
  SubtitleResponse,
  UpscaleRequest,
  MediaAsset,
  GenerationJob,
  MediaUsage,
  ProviderCapability,
  ProviderStatistics,
  ProviderConfiguration,
  ProviderRegistration,
  MediaEvent,
  MediaSnapshot
} from "./models";

export interface IMediaProviderEngine {
  initialize(): Promise<void>;
  getState(): MediaProviderState;
  getSnapshot(): MediaSnapshot;

  getImageManager(): IImageManager;
  getVideoManager(): IVideoManager;
  getVoiceManager(): IVoiceManager;
  getMusicManager(): IMusicManager;
  getSubtitleManager(): ISubtitleManager;
  getProviderManager(): IProviderManager;
  getUsageManager(): IUsageManager;
  getHealthManager(): IHealthManager;
  getEventManager(): IEventManager;
}

export interface IImageManager {
  generateImage(request: ImageGenerationRequest): Promise<MediaResponse>;
  editImage(request: ImageGenerationRequest): Promise<MediaResponse>;
  upscaleImage(request: UpscaleRequest): Promise<MediaResponse>;
}

export interface IVideoManager {
  generateVideo(request: VideoGenerationRequest): Promise<MediaResponse>;
  extendVideo(request: VideoGenerationRequest): Promise<MediaResponse>;
  imageToVideo(request: VideoGenerationRequest): Promise<MediaResponse>;
}

export interface IVoiceManager {
  textToSpeech(request: SpeechRequest): Promise<SpeechResponse>;
  speechToText(request: SubtitleRequest): Promise<SubtitleResponse>;
}

export interface IMusicManager {
  generateMusic(request: MusicRequest): Promise<MediaResponse>;
  generateSfx(request: SfxRequest): Promise<MediaResponse>;
}

export interface ISubtitleManager {
  generateSubtitles(request: SubtitleRequest): Promise<SubtitleResponse>;
}

export interface IProviderManager {
  registerProvider(config: ProviderConfiguration): Promise<ProviderRegistration>;
  unregisterProvider(provider: MediaProviderType): Promise<void>;
  getProvider(provider: MediaProviderType): ProviderRegistration | undefined;
  listProviders(): ProviderRegistration[];
  setProviderState(provider: MediaProviderType, state: MediaProviderState): void;
}

export interface IUsageManager {
  getUsage(): MediaUsage;
  recordUsage(provider: MediaProviderType, type: MediaType, amount: number, costUSD: number): void;
  resetUsage(): void;
  getStatistics(provider?: MediaProviderType): ProviderStatistics;
  recordRequest(provider: MediaProviderType, durationMs: number, success: boolean, assetsGenerated?: number, cost?: number): void;
}

export interface IHealthManager {
  checkHealth(provider: MediaProviderType): Promise<{ timestamp: Date; provider: MediaProviderType; status: ProviderHealth; latencyMs?: number }>;
  checkAllHealth(): Promise<any[]>;
  getHealthStatus(provider: MediaProviderType): ProviderHealth;
}

export interface IEventManager {
  on(eventType: MediaEventType, handler: (event: MediaEvent) => void): void;
  off(eventType: MediaEventType, handler: (event: MediaEvent) => void): void;
  emit(eventType: MediaEventType, payload?: any): void;
}
