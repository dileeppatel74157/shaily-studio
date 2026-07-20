import {
  IMediaProviderEngine,
  IImageManager,
  IVideoManager,
  IVoiceManager,
  IMusicManager,
  ISubtitleManager,
  IProviderManager,
  IUsageManager,
  IHealthManager,
  IEventManager
} from "./interfaces";
import { MediaProviderState } from "./MediaProviderState";
import { MediaProviderType } from "./MediaProviderType";
import { MediaType } from "./MediaType";
import { GenerationMode } from "./GenerationMode";
import { MediaQuality } from "./MediaQuality";
import { ProcessingState } from "./ProcessingState";
import { MediaEventType } from "./MediaEventType";
import { MediaProviderValidator } from "./MediaProviderValidator";
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
  ProviderHealth,
  MediaEvent,
  MediaSnapshot
} from "./models";
import {
  MediaProviderException,
  GenerationException,
  UnsupportedMediaException,
  ProviderUnavailableException,
  InvalidMediaRequestException,
  StreamingException,
  InvalidMediaStateException,
  deepFreeze
} from "./types";

// ─── 1. ProviderManagerImpl ──────────────────────────────────────────────────
class ProviderManagerImpl implements IProviderManager {
  private readonly _providers = new Map<MediaProviderType, ProviderRegistration>();

  constructor(private readonly _engine: MediaProviderEngine) {}

  async registerProvider(config: ProviderConfiguration): Promise<ProviderRegistration> {
    MediaProviderValidator.validateProviderConfig(config);
    MediaProviderValidator.validateApiKey(config);

    const registration: ProviderRegistration = {
      id: `prov-${config.provider.toLowerCase()}`,
      type: config.provider,
      state: MediaProviderState.READY,
      health: ProviderHealth.HEALTHY,
      config
    };

    MediaProviderValidator.validateProviderRegistration(registration);
    this._providers.set(config.provider, registration);
    return registration;
  }

  async unregisterProvider(provider: MediaProviderType): Promise<void> {
    if (!this._providers.has(provider)) {
      throw new ProviderUnavailableException(provider);
    }
    this._providers.delete(provider);
  }

  getProvider(provider: MediaProviderType): ProviderRegistration | undefined {
    return this._providers.get(provider);
  }

  listProviders(): ProviderRegistration[] {
    return Array.from(this._providers.values());
  }

  setProviderState(provider: MediaProviderType, state: MediaProviderState): void {
    const reg = this._providers.get(provider);
    if (!reg) throw new ProviderUnavailableException(provider);
    reg.state = state;
  }
}

// ─── 2. ImageManagerImpl ─────────────────────────────────────────────────────
class ImageManagerImpl implements IImageManager {
  constructor(private readonly _engine: MediaProviderEngine) {}

  async generateImage(request: ImageGenerationRequest): Promise<MediaResponse> {
    MediaProviderValidator.validatePrompt(request.prompt);
    MediaProviderValidator.validateImageSize(request.size);

    const provider = request.provider ?? MediaProviderType.OPENAI;
    const reg = this._engine.getProviderManager().getProvider(provider);
    if (!reg) throw new ProviderUnavailableException(provider);

    MediaProviderValidator.validateProviderCapability(reg, MediaType.IMAGE, request.mode);

    const start = Date.now();
    this._engine.getEventManager().emit(MediaEventType.REQUEST_STARTED, { requestId: request.id, provider, mode: request.mode });

    // Mock generated asset
    const asset: MediaAsset = {
      id: `img-${Date.now()}`,
      type: MediaType.IMAGE,
      url: `https://mockmedia.ai/images/${Date.now()}.png`,
      sizeBytes: 1024 * 1024,
      mimeType: "image/png",
      width: 1024,
      height: 1024
    };

    const durationMs = Date.now() - start;
    const cost = 0.04; // Mock flat rate

    this._engine.getUsageManager().recordUsage(provider, MediaType.IMAGE, 1, cost);
    this._engine.getUsageManager().recordRequest(provider, durationMs, true, 1, cost);
    this._engine.getEventManager().emit(MediaEventType.REQUEST_COMPLETED, { requestId: request.id, provider, assets: [asset] });
    this._engine.getEventManager().emit(MediaEventType.MEDIA_GENERATED, { type: MediaType.IMAGE, asset });

    return {
      id: `resp-${Date.now()}`,
      requestId: request.id,
      provider,
      assets: [asset],
      durationMs,
      costUSD: cost
    };
  }

  async editImage(request: ImageGenerationRequest): Promise<MediaResponse> {
    MediaProviderValidator.validatePrompt(request.prompt);

    const provider = request.provider ?? MediaProviderType.OPENAI;
    const reg = this._engine.getProviderManager().getProvider(provider);
    if (!reg) throw new ProviderUnavailableException(provider);

    MediaProviderValidator.validateProviderCapability(reg, MediaType.EDIT, request.mode);

    const start = Date.now();
    this._engine.getEventManager().emit(MediaEventType.REQUEST_STARTED, { requestId: request.id, provider, mode: request.mode });

    const asset: MediaAsset = {
      id: `img-edit-${Date.now()}`,
      type: MediaType.IMAGE,
      url: `https://mockmedia.ai/images/edited-${Date.now()}.png`,
      sizeBytes: 950 * 1024,
      mimeType: "image/png"
    };

    const durationMs = Date.now() - start;
    const cost = 0.03;

    this._engine.getUsageManager().recordUsage(provider, MediaType.IMAGE, 1, cost);
    this._engine.getUsageManager().recordRequest(provider, durationMs, true, 1, cost);
    this._engine.getEventManager().emit(MediaEventType.REQUEST_COMPLETED, { requestId: request.id, provider, assets: [asset] });

    return {
      id: `resp-edit-${Date.now()}`,
      requestId: request.id,
      provider,
      assets: [asset],
      durationMs,
      costUSD: cost
    };
  }

  async upscaleImage(request: UpscaleRequest): Promise<MediaResponse> {
    MediaProviderValidator.validateScaleFactor(request.scaleFactor);

    const provider = request.provider ?? MediaProviderType.OPENAI;
    const reg = this._engine.getProviderManager().getProvider(provider);
    if (!reg) throw new ProviderUnavailableException(provider);

    const start = Date.now();
    this._engine.getEventManager().emit(MediaEventType.REQUEST_STARTED, { requestId: request.id, provider, mode: GenerationMode.UPSCALE });

    const asset: MediaAsset = {
      id: `img-upscale-${Date.now()}`,
      type: MediaType.IMAGE,
      url: `https://mockmedia.ai/images/upscaled-${Date.now()}.png`,
      sizeBytes: 4 * 1024 * 1024,
      mimeType: "image/png"
    };

    const durationMs = Date.now() - start;
    const cost = 0.02;

    this._engine.getUsageManager().recordUsage(provider, MediaType.IMAGE, 1, cost);
    this._engine.getUsageManager().recordRequest(provider, durationMs, true, 1, cost);
    this._engine.getEventManager().emit(MediaEventType.REQUEST_COMPLETED, { requestId: request.id, provider, assets: [asset] });

    return {
      id: `resp-upscale-${Date.now()}`,
      requestId: request.id,
      provider,
      assets: [asset],
      durationMs,
      costUSD: cost
    };
  }
}

// ─── 3. VideoManagerImpl ─────────────────────────────────────────────────────
class VideoManagerImpl implements IVideoManager {
  constructor(private readonly _engine: MediaProviderEngine) {}

  async generateVideo(request: VideoGenerationRequest): Promise<MediaResponse> {
    MediaProviderValidator.validatePrompt(request.prompt);
    MediaProviderValidator.validateDuration(request.durationSeconds);
    MediaProviderValidator.validateFps(request.fps);
    MediaProviderValidator.validateResolution(request.resolution);

    const provider = request.provider ?? MediaProviderType.RUNWAY;
    const reg = this._engine.getProviderManager().getProvider(provider);
    if (!reg) throw new ProviderUnavailableException(provider);

    MediaProviderValidator.validateProviderCapability(reg, MediaType.VIDEO, request.mode);

    const start = Date.now();
    this._engine.getEventManager().emit(MediaEventType.REQUEST_STARTED, { requestId: request.id, provider, mode: request.mode });

    const duration = request.durationSeconds ?? 5;
    const asset: MediaAsset = {
      id: `vid-${Date.now()}`,
      type: MediaType.VIDEO,
      url: `https://mockmedia.ai/videos/${Date.now()}.mp4`,
      sizeBytes: 15 * 1024 * 1024,
      mimeType: "video/mp4",
      durationSeconds: duration
    };

    const durationMs = Date.now() - start;
    const cost = duration * 0.15; // $0.15 per second video mock

    this._engine.getUsageManager().recordUsage(provider, MediaType.VIDEO, duration, cost);
    this._engine.getUsageManager().recordRequest(provider, durationMs, true, 1, cost);
    this._engine.getEventManager().emit(MediaEventType.REQUEST_COMPLETED, { requestId: request.id, provider, assets: [asset] });
    this._engine.getEventManager().emit(MediaEventType.MEDIA_GENERATED, { type: MediaType.VIDEO, asset });

    return {
      id: `resp-${Date.now()}`,
      requestId: request.id,
      provider,
      assets: [asset],
      durationMs,
      costUSD: cost
    };
  }

  async extendVideo(request: VideoGenerationRequest): Promise<MediaResponse> {
    MediaProviderValidator.validatePrompt(request.prompt);

    const provider = request.provider ?? MediaProviderType.RUNWAY;
    const reg = this._engine.getProviderManager().getProvider(provider);
    if (!reg) throw new ProviderUnavailableException(provider);

    const start = Date.now();
    this._engine.getEventManager().emit(MediaEventType.REQUEST_STARTED, { requestId: request.id, provider, mode: request.mode });

    const duration = request.durationSeconds ?? 4;
    const asset: MediaAsset = {
      id: `vid-ext-${Date.now()}`,
      type: MediaType.VIDEO,
      url: `https://mockmedia.ai/videos/extended-${Date.now()}.mp4`,
      sizeBytes: 12 * 1024 * 1024,
      mimeType: "video/mp4",
      durationSeconds: duration
    };

    const durationMs = Date.now() - start;
    const cost = duration * 0.15;

    this._engine.getUsageManager().recordUsage(provider, MediaType.VIDEO, duration, cost);
    this._engine.getUsageManager().recordRequest(provider, durationMs, true, 1, cost);
    this._engine.getEventManager().emit(MediaEventType.REQUEST_COMPLETED, { requestId: request.id, provider, assets: [asset] });

    return {
      id: `resp-ext-${Date.now()}`,
      requestId: request.id,
      provider,
      assets: [asset],
      durationMs,
      costUSD: cost
    };
  }

  async imageToVideo(request: VideoGenerationRequest): Promise<MediaResponse> {
    if (!request.inputImage) {
      throw new InvalidMediaRequestException("Input image is required for image-to-video generation.");
    }

    const provider = request.provider ?? MediaProviderType.RUNWAY;
    const reg = this._engine.getProviderManager().getProvider(provider);
    if (!reg) throw new ProviderUnavailableException(provider);

    MediaProviderValidator.validateProviderCapability(reg, MediaType.VIDEO, request.mode);

    const start = Date.now();
    this._engine.getEventManager().emit(MediaEventType.REQUEST_STARTED, { requestId: request.id, provider, mode: request.mode });

    const duration = request.durationSeconds ?? 5;
    const asset: MediaAsset = {
      id: `vid-i2v-${Date.now()}`,
      type: MediaType.VIDEO,
      url: `https://mockmedia.ai/videos/i2v-${Date.now()}.mp4`,
      sizeBytes: 18 * 1024 * 1024,
      mimeType: "video/mp4",
      durationSeconds: duration
    };

    const durationMs = Date.now() - start;
    const cost = duration * 0.18;

    this._engine.getUsageManager().recordUsage(provider, MediaType.VIDEO, duration, cost);
    this._engine.getUsageManager().recordRequest(provider, durationMs, true, 1, cost);
    this._engine.getEventManager().emit(MediaEventType.REQUEST_COMPLETED, { requestId: request.id, provider, assets: [asset] });

    return {
      id: `resp-i2v-${Date.now()}`,
      requestId: request.id,
      provider,
      assets: [asset],
      durationMs,
      costUSD: cost
    };
  }
}

// ─── 4. VoiceManagerImpl ─────────────────────────────────────────────────────
class VoiceManagerImpl implements IVoiceManager {
  constructor(private readonly _engine: MediaProviderEngine) {}

  async textToSpeech(request: SpeechRequest): Promise<SpeechResponse> {
    MediaProviderValidator.validateVoiceId(request.voiceId);
    MediaProviderValidator.validateLanguageCode(request.languageCode);

    const provider = request.provider ?? MediaProviderType.ELEVENLABS;
    const reg = this._engine.getProviderManager().getProvider(provider);
    if (!reg) throw new ProviderUnavailableException(provider);

    const start = Date.now();
    this._engine.getEventManager().emit(MediaEventType.REQUEST_STARTED, { requestId: request.id, provider, mode: GenerationMode.TEXT_TO_SPEECH });

    const audioUrl = `https://mockmedia.ai/voices/${Date.now()}.mp3`;
    const duration = Math.ceil(request.text.length / 15); // mock speech rate
    const cost = request.text.length * 0.0001; // mock voice cost

    this._engine.getUsageManager().recordUsage(provider, MediaType.VOICE, duration, cost);
    this._engine.getUsageManager().recordRequest(provider, Date.now() - start, true, 1, cost);
    this._engine.getEventManager().emit(MediaEventType.REQUEST_COMPLETED, { requestId: request.id, provider });

    return {
      id: `speech-resp-${Date.now()}`,
      requestId: request.id,
      provider,
      audioUrl,
      durationSeconds: duration,
      charCount: request.text.length
    };
  }

  async speechToText(request: SubtitleRequest): Promise<SubtitleResponse> {
    const provider = MediaProviderType.WHISPER;
    const reg = this._engine.getProviderManager().getProvider(provider);
    if (!reg) throw new ProviderUnavailableException(provider);

    const start = Date.now();
    this._engine.getEventManager().emit(MediaEventType.REQUEST_STARTED, { requestId: request.id, provider, mode: GenerationMode.SPEECH_TO_TEXT });

    const content = "[Transcription of audio] Hello and welcome to Shaily Studio.";
    const cost = 0.05;

    this._engine.getUsageManager().recordUsage(provider, MediaType.TRANSCRIPTION, 10, cost); // mock 10s audio
    this._engine.getUsageManager().recordRequest(provider, Date.now() - start, true, 1, cost);
    this._engine.getEventManager().emit(MediaEventType.REQUEST_COMPLETED, { requestId: request.id, provider });

    return {
      id: `transcript-resp-${Date.now()}`,
      requestId: request.id,
      provider,
      subtitleUrl: `https://mockmedia.ai/subtitles/${Date.now()}.srt`,
      content
    };
  }
}

// ─── 5. MusicManagerImpl ─────────────────────────────────────────────────────
class MusicManagerImpl implements IMusicManager {
  constructor(private readonly _engine: MediaProviderEngine) {}

  async generateMusic(request: MusicRequest): Promise<MediaResponse> {
    MediaProviderValidator.validatePrompt(request.prompt);
    MediaProviderValidator.validateDuration(request.durationSeconds);

    const provider = request.provider ?? MediaProviderType.SUNO;
    const reg = this._engine.getProviderManager().getProvider(provider);
    if (!reg) throw new ProviderUnavailableException(provider);

    MediaProviderValidator.validateProviderCapability(reg, MediaType.MUSIC, request.mode);

    const start = Date.now();
    this._engine.getEventManager().emit(MediaEventType.REQUEST_STARTED, { requestId: request.id, provider, mode: request.mode });

    const duration = request.durationSeconds ?? 30;
    const asset: MediaAsset = {
      id: `music-${Date.now()}`,
      type: MediaType.MUSIC,
      url: `https://mockmedia.ai/music/${Date.now()}.mp3`,
      sizeBytes: 8 * 1024 * 1024,
      mimeType: "audio/mp3",
      durationSeconds: duration
    };

    const durationMs = Date.now() - start;
    const cost = duration * 0.02; // $0.02 per second mock cost

    this._engine.getUsageManager().recordUsage(provider, MediaType.MUSIC, duration, cost);
    this._engine.getUsageManager().recordRequest(provider, durationMs, true, 1, cost);
    this._engine.getEventManager().emit(MediaEventType.REQUEST_COMPLETED, { requestId: request.id, provider, assets: [asset] });
    this._engine.getEventManager().emit(MediaEventType.MEDIA_GENERATED, { type: MediaType.MUSIC, asset });

    return {
      id: `resp-${Date.now()}`,
      requestId: request.id,
      provider,
      assets: [asset],
      durationMs,
      costUSD: cost
    };
  }

  async generateSfx(request: SfxRequest): Promise<MediaResponse> {
    MediaProviderValidator.validatePrompt(request.prompt);
    MediaProviderValidator.validateSfxRequest(request);

    const provider = request.provider ?? MediaProviderType.MUSICGEN;
    const reg = this._engine.getProviderManager().getProvider(provider);
    if (!reg) throw new ProviderUnavailableException(provider);

    MediaProviderValidator.validateProviderCapability(reg, MediaType.SFX, request.mode);

    const start = Date.now();
    this._engine.getEventManager().emit(MediaEventType.REQUEST_STARTED, { requestId: request.id, provider, mode: request.mode });

    const duration = request.durationSeconds ?? 5;
    const asset: MediaAsset = {
      id: `sfx-${Date.now()}`,
      type: MediaType.SFX,
      url: `https://mockmedia.ai/sfx/${Date.now()}.wav`,
      sizeBytes: 1 * 1024 * 1024,
      mimeType: "audio/wav",
      durationSeconds: duration
    };

    const durationMs = Date.now() - start;
    const cost = duration * 0.01;

    this._engine.getUsageManager().recordUsage(provider, MediaType.SFX, duration, cost);
    this._engine.getUsageManager().recordRequest(provider, durationMs, true, 1, cost);
    this._engine.getEventManager().emit(MediaEventType.REQUEST_COMPLETED, { requestId: request.id, provider, assets: [asset] });

    return {
      id: `resp-${Date.now()}`,
      requestId: request.id,
      provider,
      assets: [asset],
      durationMs,
      costUSD: cost
    };
  }
}

// ─── 6. SubtitleManagerImpl ──────────────────────────────────────────────────
class SubtitleManagerImpl implements ISubtitleManager {
  constructor(private readonly _engine: MediaProviderEngine) {}

  async generateSubtitles(request: SubtitleRequest): Promise<SubtitleResponse> {
    MediaProviderValidator.validateSubtitleFormat(request.format);

    const provider = MediaProviderType.WHISPER;
    const reg = this._engine.getProviderManager().getProvider(provider);
    if (!reg) throw new ProviderUnavailableException(provider);

    const start = Date.now();
    this._engine.getEventManager().emit(MediaEventType.REQUEST_STARTED, { requestId: request.id, provider, mode: GenerationMode.SPEECH_TO_TEXT });

    const content = "1\n00:00:00,000 --> 00:00:04,000\nHello and welcome to Shaily Studio.";
    const cost = 0.02;

    this._engine.getUsageManager().recordUsage(provider, MediaType.SUBTITLE, 4, cost);
    this._engine.getUsageManager().recordRequest(provider, Date.now() - start, true, 1, cost);
    this._engine.getEventManager().emit(MediaEventType.REQUEST_COMPLETED, { requestId: request.id, provider });

    return {
      id: `sub-resp-${Date.now()}`,
      requestId: request.id,
      provider,
      subtitleUrl: `https://mockmedia.ai/subtitles/${Date.now()}.${request.format}`,
      content
    };
  }
}

// ─── 7. UsageManagerImpl ─────────────────────────────────────────────────────
class UsageManagerImpl implements IUsageManager {
  private readonly _usages = new Map<MediaProviderType, MediaUsage>();
  private readonly _stats = new Map<MediaProviderType, ProviderStatistics>();

  constructor(private readonly _engine: MediaProviderEngine) {}

  private getOrInitUsage(provider: MediaProviderType): MediaUsage {
    let u = this._usages.get(provider);
    if (!u) {
      u = { totalRequests: 0, imagesGenerated: 0, videosGenerated: 0, audioSecondsGenerated: 0, totalCostUSD: 0 };
      this._usages.set(provider, u);
    }
    return u;
  }

  private getOrInitStats(provider: MediaProviderType): ProviderStatistics {
    let s = this._stats.get(provider);
    if (!s) {
      s = { totalRequests: 0, successfulRequests: 0, failedRequests: 0, assetsGenerated: 0, totalDurationSeconds: 0, totalCostUSD: 0, averageLatencyMs: 0, activeJobsCount: 0 };
      this._stats.set(provider, s);
    }
    return s;
  }

  getUsage(): MediaUsage {
    const total = { totalRequests: 0, imagesGenerated: 0, videosGenerated: 0, audioSecondsGenerated: 0, totalCostUSD: 0 };
    for (const u of this._usages.values()) {
      total.totalRequests += u.totalRequests;
      total.imagesGenerated += u.imagesGenerated;
      total.videosGenerated += u.videosGenerated;
      total.audioSecondsGenerated += u.audioSecondsGenerated;
      total.totalCostUSD += u.totalCostUSD;
    }
    return total;
  }

  recordUsage(provider: MediaProviderType, type: MediaType, amount: number, costUSD: number): void {
    const u = this.getOrInitUsage(provider);
    u.totalRequests++;
    u.totalCostUSD += costUSD;

    if (type === MediaType.IMAGE) u.imagesGenerated += amount;
    else if (type === MediaType.VIDEO) u.videosGenerated += amount;
    else if (type === MediaType.VOICE || type === MediaType.MUSIC || type === MediaType.SFX) u.audioSecondsGenerated += amount;
  }

  recordRequest(provider: MediaProviderType, durationMs: number, success: boolean, assetsGenerated = 0, cost = 0): void {
    const s = this.getOrInitStats(provider);
    s.totalRequests++;
    s.totalCostUSD += cost;
    if (success) {
      s.successfulRequests++;
      s.assetsGenerated += assetsGenerated;
      s.averageLatencyMs = (s.averageLatencyMs * (s.successfulRequests - 1) + durationMs) / s.successfulRequests;
    } else {
      s.failedRequests++;
    }
  }

  resetUsage(): void {
    this._usages.clear();
    this._stats.clear();
  }

  getStatistics(provider?: MediaProviderType): ProviderStatistics {
    if (provider) {
      return this.getOrInitStats(provider);
    }
    const globalStats = { totalRequests: 0, successfulRequests: 0, failedRequests: 0, assetsGenerated: 0, totalDurationSeconds: 0, totalCostUSD: 0, averageLatencyMs: 0, activeJobsCount: 0 };
    let count = 0;
    for (const s of this._stats.values()) {
      globalStats.totalRequests += s.totalRequests;
      globalStats.successfulRequests += s.successfulRequests;
      globalStats.failedRequests += s.failedRequests;
      globalStats.assetsGenerated += s.assetsGenerated;
      globalStats.totalDurationSeconds += s.totalDurationSeconds;
      globalStats.totalCostUSD += s.totalCostUSD;
      globalStats.averageLatencyMs += s.averageLatencyMs;
      if (s.totalRequests > 0) count++;
    }
    if (count > 0) globalStats.averageLatencyMs /= count;
    return globalStats;
  }
}

// ─── 8. HealthManagerImpl ─────────────────────────────────────────────────────
class HealthManagerImpl implements IHealthManager {
  constructor(private readonly _engine: MediaProviderEngine) {}

  async checkHealth(provider: MediaProviderType): Promise<{ timestamp: Date; provider: MediaProviderType; status: ProviderHealth; latencyMs?: number }> {
    const reg = this._engine.getProviderManager().getProvider(provider);
    if (!reg) {
      return { timestamp: new Date(), provider, status: ProviderHealth.UNKNOWN };
    }
    reg.health = ProviderHealth.HEALTHY;
    return { timestamp: new Date(), provider, status: ProviderHealth.HEALTHY, latencyMs: 5 };
  }

  async checkAllHealth(): Promise<any[]> {
    const providers = this._engine.getProviderManager().listProviders();
    return Promise.all(providers.map(p => this.checkHealth(p.type)));
  }

  getHealthStatus(provider: MediaProviderType): ProviderHealth {
    const reg = this._engine.getProviderManager().getProvider(provider);
    return reg ? reg.health : ProviderHealth.UNKNOWN;
  }
}

// ─── 9. EventManagerImpl ──────────────────────────────────────────────────────
class EventManagerImpl implements IEventManager {
  private readonly _handlers = new Map<MediaEventType, Set<(e: MediaEvent) => void>>();

  constructor(private readonly _engine: MediaProviderEngine) {}

  on(eventType: MediaEventType, handler: (e: MediaEvent) => void): void {
    if (!this._handlers.has(eventType)) {
      this._handlers.set(eventType, new Set());
    }
    this._handlers.get(eventType)!.add(handler);
  }

  off(eventType: MediaEventType, handler: (e: MediaEvent) => void): void {
    this._handlers.get(eventType)?.delete(handler);
  }

  emit(eventType: MediaEventType, payload?: any): void {
    const set = this._handlers.get(eventType);
    if (!set) return;
    const event: MediaEvent = { type: eventType, timestamp: new Date(), payload };
    for (const h of set) h(event);
  }
}

// ─── 10. MediaProviderEngine ──────────────────────────────────────────────────
export class MediaProviderEngine implements IMediaProviderEngine {
  private _state = MediaProviderState.CREATED;

  private readonly _providerManager: ProviderManagerImpl;
  private readonly _imageManager: ImageManagerImpl;
  private readonly _videoManager: VideoManagerImpl;
  private readonly _voiceManager: VoiceManagerImpl;
  private readonly _musicManager: MusicManagerImpl;
  private readonly _subtitleManager: SubtitleManagerImpl;
  private readonly _usageManager: UsageManagerImpl;
  private readonly _healthManager: HealthManagerImpl;
  private readonly _eventManager: EventManagerImpl;

  constructor(private readonly _context: any) {
    MediaProviderValidator.validateContext(_context);

    this._providerManager  = new ProviderManagerImpl(this);
    this._imageManager     = new ImageManagerImpl(this);
    this._videoManager     = new VideoManagerImpl(this);
    this._voiceManager     = new VoiceManagerImpl(this);
    this._musicManager     = new MusicManagerImpl(this);
    this._subtitleManager  = new SubtitleManagerImpl(this);
    this._usageManager     = new UsageManagerImpl(this);
    this._healthManager    = new HealthManagerImpl(this);
    this._eventManager     = new EventManagerImpl(this);
  }

  async initialize(): Promise<void> {
    if (this._state !== MediaProviderState.CREATED) {
      throw new InvalidMediaStateException("initialize", this._state);
    }
    this._state = MediaProviderState.INITIALIZING;
    await new Promise(r => setTimeout(r, 0));
    this._state = MediaProviderState.READY;
  }

  getState(): MediaProviderState { return this._state; }

  getSnapshot(): MediaSnapshot {
    const providersCopy = this._providerManager.listProviders().map(p => ({
      ...p,
      config: {
        ...p.config,
        capabilities: { ...p.config.capabilities, supportedTypes: [...p.config.capabilities.supportedTypes], supportedModes: [...p.config.capabilities.supportedModes] }
      }
    }));

    const statistics: Record<string, ProviderStatistics> = {};
    for (const p of this._providerManager.listProviders()) {
      statistics[p.type] = { ...this._usageManager.getStatistics(p.type) };
    }

    return deepFreeze<MediaSnapshot>({
      timestamp: new Date(),
      state: this._state,
      providers: providersCopy,
      statistics,
      globalUsage: { ...this._usageManager.getUsage() },
      activeJobs: []
    });
  }

  getImageManager(): IImageManager       { return this._imageManager; }
  getVideoManager(): IVideoManager       { return this._videoManager; }
  getVoiceManager(): IVoiceManager       { return this._voiceManager; }
  getMusicManager(): IMusicManager       { return this._musicManager; }
  getSubtitleManager(): ISubtitleManager { return this._subtitleManager; }
  getProviderManager(): IProviderManager { return this._providerManager; }
  getUsageManager(): IUsageManager       { return this._usageManager; }
  getHealthManager(): IHealthManager     { return this._healthManager; }
  getEventManager(): IEventManager       { return this._eventManager; }
}
