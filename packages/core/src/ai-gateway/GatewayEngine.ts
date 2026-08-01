import { GatewayState } from "./GatewayState";
import { ProviderAdapterType } from "./ProviderAdapterType";
import { RequestRoutingStrategy } from "./RequestRoutingStrategy";
import { CircuitBreakerState } from "./CircuitBreakerState";
import { AuthStrategy } from "./AuthStrategy";
import { GatewayEventType } from "./GatewayEventType";
import {
  IGatewayEngine,
  IProviderRegistry,
  IRequestRouter,
  IResponseManager,
  IAuthenticationManager,
  IRetryEngine,
  IUsageMonitor,
  IGatewayValidator,
  IGatewayReporter,
  IProviderAdapter
} from "./interfaces";
import {
  GatewayConfiguration,
  GatewayRequest,
  GatewayResponse,
  GatewayResponseChunk,
  ProviderRegistryEntry,
  ProviderCapabilities,
  ProviderHealthStatus,
  AuthCredential,
  AuthValidationResult,
  RetryAttempt,
  CircuitBreakerStatus,
  UsageRecord,
  DailyQuotaStatus,
  RateLimitStatus,
  ProviderCooldown,
  GatewaySnapshot,
  GatewayRouteDecision,
  GatewayReport,
  FailureTrackingEntry,
  LoadBalancerState
} from "./models";
import { GatewayValidator } from "./GatewayValidator";
import {
  InvalidGatewayStateException,
  GatewayException,
  ProviderNotFoundException,
  CircuitOpenException,
  deepFreeze
} from "./types";

// ---------------------------------------------------------------------------
// Built-in provider adapter implementations
// ---------------------------------------------------------------------------
class BuiltInAdapter implements IProviderAdapter {
  private _realProvider: any;

  constructor(
    public readonly providerId: string,
    public readonly adapterType: ProviderAdapterType,
    private readonly _context?: any
  ) {}

  async connect(): Promise<void> {
    let apiKey = process.env[`${this.adapterType}_API_KEY`] || process.env[`${this.providerId.toUpperCase()}_API_KEY`];
    if (this.adapterType === ProviderAdapterType.GEMINI_IMAGE || this.adapterType === ProviderAdapterType.GEMINI_VIDEO || this.adapterType === ProviderAdapterType.GEMINI_VOICE) {
      apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || apiKey;
    }
    const isMockKey = !apiKey || apiKey.includes("-mock-key-value-12345") || apiKey.includes("your_") || apiKey.includes("sk-proj-");

    if (apiKey && !isMockKey) {
      try {
        if (this.adapterType === ProviderAdapterType.GEMINI) {
          const { GeminiProvider } = require("@shaily/provider-google");
          this._realProvider = new GeminiProvider(
            this.providerId,
            "Gemini Real Provider",
            { env: "prod", namespace: "studio" },
            { apiKey }
          );
        } else if (this.adapterType === ProviderAdapterType.GEMINI_IMAGE) {
          const { GeminiImageProvider } = require("@shaily/provider-google");
          const storage = typeof this._context?.resolve === "function" ? this._context.resolve("IStorage") : undefined;
          this._realProvider = new GeminiImageProvider(
            this.providerId,
            "Gemini Image Real Provider",
            { env: "prod", namespace: "studio", storage },
            { apiKey }
          );
        } else if (this.adapterType === ProviderAdapterType.GEMINI_VIDEO) {
          const { GeminiVideoProvider } = require("@shaily/provider-google");
          const storage = typeof this._context?.resolve === "function" ? this._context.resolve("IStorage") : undefined;
          this._realProvider = new GeminiVideoProvider(
            this.providerId,
            "Gemini Video Real Provider",
            { env: "prod", namespace: "studio", storage },
            { apiKey }
          );
        } else if (this.adapterType === ProviderAdapterType.GEMINI_VOICE) {
          const { GeminiVoiceProvider } = require("@shaily/provider-google");
          const storage = typeof this._context?.resolve === "function" ? this._context.resolve("IStorage") : undefined;
          this._realProvider = new GeminiVoiceProvider(
            this.providerId,
            "Gemini Voice Real Provider",
            { env: "prod", namespace: "studio", storage },
            { apiKey }
          );
        } else if (this.adapterType === ProviderAdapterType.OPENAI) {
          const { OpenAIProvider } = require("@shaily/provider-openai");
          this._realProvider = new OpenAIProvider(
            this.providerId,
            "OpenAI Real Provider",
            { env: "prod", namespace: "studio" },
            { apiKey }
          );
        } else if (this.adapterType === ProviderAdapterType.NVIDIA) {
          const { NvidiaProvider } = require("@shaily/provider-nvidia");
          this._realProvider = new NvidiaProvider(
            this.providerId,
            "Nvidia Real Provider",
            { env: "prod", namespace: "studio" },
            { apiKey }
          );
        } else if (this.adapterType === ProviderAdapterType.GROK) {
          const { GrokProvider } = require("@shaily/provider-grok");
          this._realProvider = new GrokProvider(
            this.providerId,
            "Grok Real Provider",
            { env: "prod", namespace: "studio" },
            { apiKey }
          );
        } else if (this.adapterType === ProviderAdapterType.OLLAMA) {
          const { OllamaProvider } = require("@shaily/provider-ollama");
          this._realProvider = new OllamaProvider(
            this.providerId,
            "Ollama Real Provider",
            { env: "prod", namespace: "studio" },
            { baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434" }
          );
        }

        if (this._realProvider) {
          await this._realProvider.initialize();
          await this._realProvider.start();
        }
      } catch (err) {
        this._realProvider = undefined;
      }
    }
  }

  async execute(request: GatewayRequest): Promise<GatewayResponse> {
    if (this._realProvider) {
      const start = Date.now();
      
      if (this.adapterType === ProviderAdapterType.GEMINI_IMAGE) {
        const response = await this._realProvider.execute({
          model: request.model,
          prompt: request.prompt,
          negativePrompt: request.imageParams?.negativePrompt,
          width: request.imageParams?.width,
          height: request.imageParams?.height,
          numberOfImages: request.imageParams?.numberOfImages || request.imageParams?.numImages || 1,
          seed: request.imageParams?.seed,
          mimeType: request.imageParams?.mimeType,
          requestId: request.requestId,
        });
        const latencyMs = Date.now() - start;
        return {
          requestId: request.requestId,
          providerId: this.providerId,
          model: response.model,
          content: response.storedImagePath || response.content,
          text: response.storedImagePath || response.text,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          costUsd: 0.05,
          latencyMs,
          finishReason: "stop",
          metadata: {
            storageBucket: response.storageBucket,
            mimeType: response.mimeType,
            width: response.width,
            height: response.height,
            imageMetadata: response.metadata
          },
          assets: [
            {
              id: `asset-${Date.now()}`,
              type: "IMAGE",
              url: response.storedImagePath,
              mimeType: response.mimeType,
              width: response.width,
              height: response.height,
              metadata: response.metadata
            }
          ]
        };
      }

      if (this.adapterType === ProviderAdapterType.GEMINI_VIDEO) {
        const response = await this._realProvider.execute({
          model: request.model,
          prompt: request.prompt,
          negativePrompt: request.videoParams?.negativePrompt,
          duration: request.videoParams?.duration,
          aspectRatio: request.videoParams?.aspectRatio,
          resolution: request.videoParams?.resolution,
          seed: request.videoParams?.seed,
          fps: request.videoParams?.fps,
          mimeType: request.videoParams?.mimeType,
          requestId: request.requestId,
        });
        const latencyMs = Date.now() - start;
        return {
          requestId: request.requestId,
          providerId: this.providerId,
          model: response.model,
          content: response.storedVideoPath || response.content,
          text: response.storedVideoPath || response.text,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          costUsd: 0.10,
          latencyMs,
          finishReason: "stop",
          metadata: {
            storageBucket: response.storageBucket,
            mimeType: response.mimeType,
            duration: response.duration,
            resolution: response.resolution,
            operationId: response.operationId,
            videoMetadata: response.metadata
          },
          assets: [
            {
              id: `asset-${Date.now()}`,
              type: "VIDEO",
              url: response.storedVideoPath,
              mimeType: response.mimeType,
              duration: response.duration,
              resolution: response.resolution,
              metadata: response.metadata
            }
          ]
        };
      }

      if (this.adapterType === ProviderAdapterType.GEMINI_VOICE ||
          this.adapterType === ProviderAdapterType.ELEVENLABS_VOICE ||
          this.adapterType === ProviderAdapterType.OPENAI_VOICE) {
        
        const voiceMode = request.voiceParams?.mode || (request.voiceParams?.audioUrl ? "stt" : "tts");

        if (this._realProvider) {
          const response = await this._realProvider.execute({
            model: request.model,
            prompt: request.prompt,
            requestId: request.requestId,
            voiceParams: request.voiceParams
          });
          const latencyMs = Date.now() - start;
          
          return {
            requestId: request.requestId,
            providerId: this.providerId,
            model: response.model,
            content: response.content || response.text || "",
            text: response.text || response.content || "",
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            costUsd: voiceMode === "stt" ? 0.015 : 0.005,
            latencyMs,
            finishReason: "stop",
            metadata: response.metadata || {},
            assets: response.assets || [
              {
                id: `asset-${Date.now()}`,
                type: voiceMode === "stt" ? "SUBTITLE" : "VOICE",
                url: voiceMode === "stt" ? response.storedSubtitlePath : response.storedVoicePath,
                mimeType: voiceMode === "stt" ? "text/plain" : `audio/${request.voiceParams?.outputFormat || "mp3"}`,
                metadata: response.metadata
              }
            ]
          };
        }

        const fs = require("fs");
        const path = require("path");
        const latencyMs = Date.now() - start + 50;

        if (voiceMode === "stt") {
          const transcription = `[${this.providerId.toUpperCase()} STT] Mock transcription: The quick brown fox jumps over the lazy dog.`;
          const bucketId = process.env.STORAGE_BUCKET_AUDIO || "audio";
          const transcriptId = `transcript-${Date.now()}-${Math.floor(Math.random() * 10000)}.srt`;
          const storedSubtitlePath = `${bucketId}/${transcriptId}`;
          const subtitleContent = `1\n00:00:00,000 --> 00:00:05,000\n${transcription}`;
          const subtitleBuffer = Buffer.from(subtitleContent);

          const storage = typeof this._context?.resolve === "function" ? this._context.resolve("IStorage") : undefined;
          if (storage) {
            if (typeof storage.hasBucket === "function" && !storage.hasBucket(bucketId)) {
              await storage.createBucket({
                id: bucketId,
                name: bucketId,
                description: "Audio Bucket",
                created: new Date()
              });
            }
            await storage.putObject(bucketId, {
              id: transcriptId,
              bucketId,
              content: subtitleBuffer,
              metadata: { contentType: "text/srt", size: subtitleBuffer.length, created: new Date(), updated: new Date() }
            });
          } else {
            const storageDir = path.join(process.cwd(), "storage", "media");
            if (!fs.existsSync(storageDir)) {
              fs.mkdirSync(storageDir, { recursive: true });
            }
            fs.writeFileSync(path.join(storageDir, transcriptId), subtitleBuffer);
          }

          return {
            requestId: request.requestId,
            providerId: this.providerId,
            model: request.model,
            content: transcription,
            text: transcription,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            costUsd: 0.015,
            latencyMs,
            finishReason: "stop",
            metadata: {
              storedSubtitlePath,
              subtitleUrl: storedSubtitlePath,
              storageBucket: bucketId,
              mimeType: "text/plain"
            },
            assets: [
              {
                id: `asset-${Date.now()}`,
                type: "SUBTITLE",
                url: `file:///${path.join(process.cwd(), "storage", "media", transcriptId).replace(/\\/g, "/")}`,
                mimeType: "text/plain"
              }
            ]
          };

        } else {
          const extension = request.voiceParams?.outputFormat || "mp3";
          const audioBuffer = Buffer.from(`mock-speech-audio-binary-data-for-${this.providerId}-${Date.now()}`);
          const bucketId = process.env.STORAGE_BUCKET_AUDIO || "audio";
          const audioId = `speech-${Date.now()}-${Math.floor(Math.random() * 10000)}.${extension}`;
          const storedVoicePath = `${bucketId}/${audioId}`;

          const storage = typeof this._context?.resolve === "function" ? this._context.resolve("IStorage") : undefined;
          if (storage) {
            if (typeof storage.hasBucket === "function" && !storage.hasBucket(bucketId)) {
              await storage.createBucket({
                id: bucketId,
                name: bucketId,
                description: "Audio Bucket",
                created: new Date()
              });
            }
            await storage.putObject(bucketId, {
              id: audioId,
              bucketId,
              content: audioBuffer,
              metadata: { contentType: `audio/${extension}`, size: audioBuffer.length, created: new Date(), updated: new Date() }
            });
          } else {
            const storageDir = path.join(process.cwd(), "storage", "media");
            if (!fs.existsSync(storageDir)) {
              fs.mkdirSync(storageDir, { recursive: true });
            }
            fs.writeFileSync(path.join(storageDir, audioId), audioBuffer);
          }

          return {
            requestId: request.requestId,
            providerId: this.providerId,
            model: request.model,
            content: storedVoicePath,
            text: storedVoicePath,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            costUsd: 0.005,
            latencyMs,
            finishReason: "stop",
            metadata: {
              storedVoicePath,
              storageBucket: bucketId,
              mimeType: `audio/${extension}`,
              durationSeconds: Math.ceil((request.prompt || "").length / 15),
              charCount: (request.prompt || "").length
            },
            assets: [
              {
                id: `asset-${Date.now()}`,
                type: "VOICE",
                url: `file:///${path.join(process.cwd(), "storage", "media", audioId).replace(/\\/g, "/")}`,
                mimeType: `audio/${extension}`
              }
            ]
          };
        }
      }

      const response = await this._realProvider.execute({
        model: request.model,
        messages: [{ role: "user", content: request.prompt }],
        temperature: 0.7,
        maxTokens: 1000
      });
      const latencyMs = Date.now() - start;
      return {
        requestId: request.requestId,
        providerId: this.providerId,
        model: response.model,
        content: response.content || response.text || "",
        promptTokens: response.usage?.promptTokens || 0,
        completionTokens: response.usage?.completionTokens || 0,
        totalTokens: response.usage?.totalTokens || 0,
        costUsd: (response.usage?.totalTokens || 0) * 0.000_002,
        latencyMs,
        finishReason: response.finishReason || "stop"
      };
    }

    const start = Date.now();

    if (this.adapterType === ProviderAdapterType.GEMINI_VOICE ||
        this.adapterType === ProviderAdapterType.ELEVENLABS_VOICE ||
        this.adapterType === ProviderAdapterType.OPENAI_VOICE) {
      
      const fs = require("fs");
      const path = require("path");
      const voiceMode = request.voiceParams?.mode || (request.voiceParams?.audioUrl ? "stt" : "tts");
      const latencyMs = Date.now() - start + 50;

      if (voiceMode === "stt") {
        const transcription = `[${this.providerId.toUpperCase()} STT] Mock transcription: The quick brown fox jumps over the lazy dog.`;
        const bucketId = process.env.STORAGE_BUCKET_AUDIO || "audio";
        const transcriptId = `transcript-${Date.now()}-${Math.floor(Math.random() * 10000)}.srt`;
        const storedSubtitlePath = `${bucketId}/${transcriptId}`;
        const subtitleContent = `1\n00:00:00,000 --> 00:00:05,000\n${transcription}`;
        const subtitleBuffer = Buffer.from(subtitleContent);

        const storage = typeof this._context?.resolve === "function" ? this._context.resolve("IStorage") : undefined;
        if (storage) {
          if (typeof storage.hasBucket === "function" && !storage.hasBucket(bucketId)) {
            await storage.createBucket({
              id: bucketId,
              name: bucketId,
              description: "Audio Bucket",
              created: new Date()
            });
          }
          await storage.putObject(bucketId, {
            id: transcriptId,
            bucketId,
            content: subtitleBuffer,
            metadata: { contentType: "text/srt", size: subtitleBuffer.length, created: new Date(), updated: new Date() }
          });
        } else {
          const storageDir = path.join(process.cwd(), "storage", "media");
          if (!fs.existsSync(storageDir)) {
            fs.mkdirSync(storageDir, { recursive: true });
          }
          fs.writeFileSync(path.join(storageDir, transcriptId), subtitleBuffer);
        }

        return {
          requestId: request.requestId,
          providerId: this.providerId,
          model: request.model,
          content: transcription,
          text: transcription,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          costUsd: 0.015,
          latencyMs,
          finishReason: "stop",
          metadata: {
            storedSubtitlePath,
            subtitleUrl: storedSubtitlePath,
            storageBucket: bucketId,
            mimeType: "text/plain"
          },
          assets: [
            {
              id: `asset-${Date.now()}`,
              type: "SUBTITLE",
              url: `file:///${path.join(process.cwd(), "storage", "media", transcriptId).replace(/\\/g, "/")}`,
              mimeType: "text/plain"
            }
          ]
        };

      } else {
        const extension = request.voiceParams?.outputFormat || "mp3";
        const audioBuffer = Buffer.from(`mock-speech-audio-binary-data-for-${this.providerId}-${Date.now()}`);
        const bucketId = process.env.STORAGE_BUCKET_AUDIO || "audio";
        const audioId = `speech-${Date.now()}-${Math.floor(Math.random() * 10000)}.${extension}`;
        const storedVoicePath = `${bucketId}/${audioId}`;

        const storage = typeof this._context?.resolve === "function" ? this._context.resolve("IStorage") : undefined;
        if (storage) {
          if (typeof storage.hasBucket === "function" && !storage.hasBucket(bucketId)) {
            await storage.createBucket({
              id: bucketId,
              name: bucketId,
              description: "Audio Bucket",
              created: new Date()
            });
          }
          await storage.putObject(bucketId, {
            id: audioId,
            bucketId,
            content: audioBuffer,
            metadata: { contentType: `audio/${extension}`, size: audioBuffer.length, created: new Date(), updated: new Date() }
          });
        } else {
          const storageDir = path.join(process.cwd(), "storage", "media");
          if (!fs.existsSync(storageDir)) {
            fs.mkdirSync(storageDir, { recursive: true });
          }
          fs.writeFileSync(path.join(storageDir, audioId), audioBuffer);
        }

        return {
          requestId: request.requestId,
          providerId: this.providerId,
          model: request.model,
          content: storedVoicePath,
          text: storedVoicePath,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          costUsd: 0.005,
          latencyMs,
          finishReason: "stop",
          metadata: {
            storedVoicePath,
            storageBucket: bucketId,
            mimeType: `audio/${extension}`,
            durationSeconds: Math.ceil((request.prompt || "").length / 15),
            charCount: (request.prompt || "").length
          },
          assets: [
            {
              id: `asset-${Date.now()}`,
              type: "VOICE",
              url: `file:///${path.join(process.cwd(), "storage", "media", audioId).replace(/\\/g, "/")}`,
              mimeType: `audio/${extension}`
            }
          ]
        };
      }
    }

    const promptTokens = Math.ceil(request.prompt.length / 4);
    const completionTokens = Math.floor(promptTokens * 0.6);
    return {
      requestId: request.requestId,
      providerId: this.providerId,
      model: request.model,
      content: `[${this.adapterType}] Response for: "${request.prompt.slice(0, 60)}..."`,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      costUsd: (promptTokens + completionTokens) * 0.000_002,
      latencyMs: Date.now() - start + 10,
      finishReason: "stop"
    };
  }

  async *stream(request: GatewayRequest): AsyncGenerator<GatewayResponseChunk> {
    if (this._realProvider) {
      const chunks = this._realProvider.stream({
        model: request.model,
        messages: [{ role: "user", content: request.prompt }],
        temperature: 0.7,
        maxTokens: 1000
      });
      let index = 0;
      for await (const chunk of chunks) {
        yield {
          requestId: request.requestId,
          chunkIndex: index++,
          delta: chunk.content || "",
          done: false
        };
      }
      yield {
        requestId: request.requestId,
        chunkIndex: index,
        delta: "",
        done: true
      };
      return;
    }

    const words = `[${this.adapterType}] Streaming response for: ${request.prompt}`.split(" ");
    for (let i = 0; i < words.length; i++) {
      yield {
        requestId: request.requestId,
        chunkIndex: i,
        delta: words[i] + " ",
        done: i === words.length - 1
      };
    }
  }

  async disconnect(): Promise<void> {
    if (this._realProvider) {
      await this._realProvider.stop().catch(() => {});
    }
  }

  async healthCheck(): Promise<ProviderHealthStatus> {
    if (this._realProvider) {
      const health = this._realProvider.health();
      return {
        providerId: this.providerId,
        healthy: health.status === "HEALTHY",
        lastChecked: new Date(),
        failureCount: 0,
        consecutiveFails: 0,
        averageLatencyMs: health.latency
      };
    }
    return {
      providerId: this.providerId,
      healthy: true,
      lastChecked: new Date(),
      failureCount: 0,
      consecutiveFails: 0,
      averageLatencyMs: 120
    };
  }
}

// ---------------------------------------------------------------------------
// GatewayEngine — master coordinator
// ---------------------------------------------------------------------------
export class GatewayEngine implements
  IGatewayEngine,
  IProviderRegistry,
  IRequestRouter,
  IResponseManager,
  IAuthenticationManager,
  IRetryEngine,
  IUsageMonitor,
  IGatewayValidator,
  IGatewayReporter
{
  private _state: GatewayState = GatewayState.CREATED;
  private readonly _config: GatewayConfiguration;
  private readonly _context: any;
  private readonly _validator = new GatewayValidator();

  // Registry
  private readonly _providers = new Map<string, ProviderRegistryEntry>();
  private readonly _adapters  = new Map<string, IProviderAdapter>();
  private readonly _health    = new Map<string, ProviderHealthStatus>();

  // Auth
  private readonly _credentials = new Map<string, AuthCredential>();

  // Retry / circuit-breaker
  private readonly _circuits  = new Map<string, CircuitBreakerStatus>();
  private readonly _cooldowns = new Map<string, ProviderCooldown>();
  private readonly _retryHistory = new Map<string, RetryAttempt[]>();
  private readonly _failures  : FailureTrackingEntry[] = [];

  // Usage
  private readonly _usageRecords: UsageRecord[] = [];
  private readonly _requestCounts = new Map<string, number>();
  private _totalCostUsd = 0;

  // Load-balancer state
  private _loadBalancer: LoadBalancerState = {
    providerWeights: {},
    requestCounts: {},
    lastRebalancedAt: new Date()
  };

  // Round-robin cursor
  private _rrCursor = 0;

  // Startup timestamp
  private _startedAt: Date = new Date();

  constructor(context: any, config: GatewayConfiguration) {
    this._context = context;
    this._config = config;
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================
  private transitionState(next: GatewayState): void {
    const valid: Record<GatewayState, GatewayState[]> = {
      [GatewayState.CREATED]:      [GatewayState.INITIALIZING],
      [GatewayState.INITIALIZING]: [GatewayState.RUNNING, GatewayState.ERROR],
      [GatewayState.RUNNING]:      [GatewayState.STOPPING, GatewayState.ERROR],
      [GatewayState.STOPPING]:     [GatewayState.STOPPED],
      [GatewayState.STOPPED]:      [GatewayState.INITIALIZING],
      [GatewayState.ERROR]:        [GatewayState.INITIALIZING]
    };
    if (!valid[this._state].includes(next)) {
      throw new InvalidGatewayStateException(`transition to ${next}`, this._state);
    }
    this._state = next;
  }

  async initialize(): Promise<void> {
    this.transitionState(GatewayState.INITIALIZING);
    this._validator.validate(this.getSnapshot());
    this._registerBuiltInProviders();
    for (const adapter of this._adapters.values()) {
      await adapter.connect().catch(() => {});
    }
    this._startedAt = new Date();
    this.transitionState(GatewayState.RUNNING);
    await this._context.eventBus?.publish({ type: GatewayEventType.REQUEST_ROUTED, payload: { status: "initialized" } });
  }

  async start(): Promise<void> {
    if (this._state !== GatewayState.RUNNING) {
      await this.initialize();
    }
  }

  async stop(): Promise<void> {
    this.transitionState(GatewayState.STOPPING);
    for (const adapter of this._adapters.values()) {
      await adapter.disconnect();
    }
    this.transitionState(GatewayState.STOPPED);
  }

  getState(): GatewayState { return this._state; }

  getSnapshot(): GatewaySnapshot {
    return deepFreeze<GatewaySnapshot>({
      state: this._state,
      configuration: JSON.parse(JSON.stringify(this._config)),
      timestamp: new Date()
    });
  }

  // ===========================================================================
  // Main pipeline
  // ===========================================================================
  private _isRecoverableError(error: any): boolean {
    const message = String(error.message || error).toLowerCase();
    const status = error.status || error.statusCode;

    // Unrecoverable HTTP status codes
    if (status === 400 || status === 401 || status === 403 || status === 404) {
      // Treat quota exceeded as recoverable even if 403 or 429
      if (message.includes("quota")) return true;
      return false;
    }

    // Explicit unrecoverable phrases
    if (
      message.includes("api key") || 
      message.includes("unauthorized") || 
      message.includes("invalid request") || 
      message.includes("not found") ||
      message.includes("bad request") ||
      message.includes("malformed payload") ||
      message.includes("validation error") ||
      message.includes("unsupported model")
    ) {
      return false;
    }

    return true; // Default to recoverable for timeouts, 429s, network failures, connection resets, circuit breaker open, etc.
  }

  async execute(request: GatewayRequest): Promise<GatewayResponse> {
    this._validator.validateRequest(request.requestId, request.prompt, request.model, request.requestType, request.embeddingInput);

    const decision = this.route(request);
    const providersToTry = [decision.selectedProviderId, ...(decision.alternates || [])];
    
    let lastError: any;

    for (const providerId of providersToTry) {
      const adapter = this._adapters.get(providerId);
      if (!adapter) continue;

      // Check circuit breaker/cooldown early before attempting
      const status = this.getCircuitStatus(providerId);
      if (status.state === CircuitBreakerState.OPEN) {
        lastError = new CircuitOpenException(providerId);
        continue;
      }

      try {
        const response = await this.executeWithRetry(async () => {
          const start = Date.now();
          const raw = await adapter.execute({ ...request, providerId });
          return this.normalize(raw, request, Date.now() - start);
        }, providerId);

        this.collectUsage(response);
        this.countRequest(providerId);
        await this._context.eventBus?.publish({ type: GatewayEventType.RESPONSE_RECEIVED, payload: response });

        return response;
      } catch (err: any) {
        lastError = err;
        
        // If error is unrecoverable, abort immediately (no fallback)
        if (!this._isRecoverableError(err)) {
          break;
        }

        this._context.logger?.warn(`Provider "${providerId}" failed with recoverable error: ${err.message}. Retrying on fallback provider...`);
        
        // Push fallback event
        if (this._context.eventBus) {
          await this._context.eventBus.publish({
            type: GatewayEventType.REQUEST_ROUTED,
            payload: {
              status: "fallback",
              fromProvider: providerId,
              error: err.message
            }
          });
        }
      }
    }

    throw new GatewayException(`All candidate providers failed. Last error: ${lastError?.message || lastError}`);
  }

  async *stream(request: GatewayRequest): AsyncGenerator<GatewayResponseChunk> {
    this._validator.validateRequest(request.requestId, request.prompt, request.model, request.requestType, request.embeddingInput);
    this._validator.validateStreamingResponse(request.requestId);

    const decision = this.route(request);
    const providersToTry = [decision.selectedProviderId, ...(decision.alternates || [])];

    let lastError: any;

    for (const providerId of providersToTry) {
      const adapter = this._adapters.get(providerId);
      if (!adapter) continue;

      // Check circuit breaker state
      const status = this.getCircuitStatus(providerId);
      if (status.state === CircuitBreakerState.OPEN) {
        lastError = new CircuitOpenException(providerId);
        continue;
      }

      try {
        yield* adapter.stream({ ...request, providerId });
        return; // Success, return
      } catch (err: any) {
        lastError = err;
        if (!this._isRecoverableError(err)) {
          break;
        }
        this._context.logger?.warn(`Provider "${providerId}" streaming failed: ${err.message}. Trying fallback...`);
      }
    }

    throw new GatewayException(`All candidate providers failed during streaming. Last error: ${lastError?.message || lastError}`);
  }

  // ===========================================================================
  // IProviderRegistry
  // ===========================================================================
  registerProvider(entry: ProviderRegistryEntry): void {
    this._providers.set(entry.providerId, entry);
    this._health.set(entry.providerId, {
      providerId: entry.providerId,
      healthy: true,
      lastChecked: new Date(),
      failureCount: 0,
      consecutiveFails: 0,
      averageLatencyMs: 0
    });
    this._loadBalancer.providerWeights[entry.providerId] = entry.priority;
    this._loadBalancer.requestCounts[entry.providerId]   = 0;
  }

  discoverProviders(): ProviderRegistryEntry[] {
    return Array.from(this._providers.values()).filter(p => p.enabled);
  }

  getCapabilities(providerId: string): ProviderCapabilities | undefined {
    return this._providers.get(providerId)?.capabilities;
  }

  getProviderHealth(providerId: string): ProviderHealthStatus {
    return this._health.get(providerId) ?? {
      providerId,
      healthy: false,
      lastChecked: new Date(),
      failureCount: 0,
      consecutiveFails: 0,
      averageLatencyMs: 0
    };
  }

  getProviderVersion(providerId: string): string | undefined {
    return this._providers.get(providerId)?.version;
  }

  // ===========================================================================
  // IRequestRouter
  // ===========================================================================
  route(request: GatewayRequest): GatewayRouteDecision {
    let providers = this.discoverProviders();
    if (providers.length === 0) throw new GatewayException("No providers registered in gateway.");

    // Filter based on capabilities
    if (request.requestType) {
      if (request.requestType === "chat") {
        providers = providers.filter(p => p.capabilities.supportsChat !== false);
      } else if (request.requestType === "image") {
        providers = providers.filter(p => p.capabilities.supportsImages === true);
      } else if (request.requestType === "video") {
        providers = providers.filter(p => p.capabilities.supportsVideo === true);
      } else if (request.requestType === "voice") {
        providers = providers.filter(p => p.capabilities.supportsVoice === true);
      } else if (request.requestType === "embeddings") {
        providers = providers.filter(p => p.capabilities.supportsEmbeddings === true);
      }
    }

    if (providers.length === 0) {
      throw new GatewayException(`No providers found supporting requestType "${request.requestType}".`);
    }

    let selected = request.providerId;
    const strategy = this._config.routingStrategy;

    if (!selected || !providers.some(p => p.providerId === selected)) {
      // Auto-select using strategy
      if (strategy === RequestRoutingStrategy.ROUND_ROBIN) {
        selected = providers[this._rrCursor % providers.length].providerId;
        this._rrCursor++;
      } else if (strategy === RequestRoutingStrategy.PRIORITY) {
        selected = providers.sort((a, b) => b.priority - a.priority)[0].providerId;
      } else if (strategy === RequestRoutingStrategy.CHEAPEST) {
        selected = providers[0].providerId; // simulated cheapest
      } else {
        selected = providers[0].providerId; // default
      }
    }

    const alternates = providers
      .filter(p => p.providerId !== selected)
      .sort((a, b) => b.priority - a.priority)
      .map(p => p.providerId);
    this._validator.validateRouteDecision(selected);

    return { selectedProviderId: selected, strategy, alternates, reason: "auto-selected" };
  }

  selectModel(providerId: string, hint?: string): string {
    const entry = this._providers.get(providerId);
    if (!entry) return hint ?? "default-model";
    return hint ?? entry.capabilities.availableModels[0] ?? "default-model";
  }

  applyFallback(failedProviderId: string, request: GatewayRequest): string | undefined {
    const decision = this.route(request);
    const alternates = [decision.selectedProviderId, ...(decision.alternates || [])].filter(id => id !== failedProviderId);
    return alternates[0];
  }

  balanceLoad(): LoadBalancerState {
    this._loadBalancer.lastRebalancedAt = new Date();
    return { ...this._loadBalancer };
  }

  handleTimeout(requestId: string, timeoutMs: number): void {
    this._context.logger?.warn(`Request "${requestId}" timed out after ${timeoutMs}ms.`);
  }

  // ===========================================================================
  // IResponseManager
  // ===========================================================================
  normalize(raw: any, request: GatewayRequest, latencyMs: number): GatewayResponse {
    if (raw && raw.requestId) return raw as GatewayResponse; // Already normalized
    const promptTokens      = Math.ceil((request.prompt?.length ?? 0) / 4);
    const completionTokens  = Math.floor(promptTokens * 0.6);
    const cost = this.calculateCost(promptTokens, completionTokens, request.providerId);
    this._validator.validateCost(cost);
    return {
      requestId: request.requestId,
      providerId: request.providerId,
      model: request.model,
      content: String(raw?.content ?? ""),
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      costUsd: cost,
      latencyMs,
      finishReason: raw?.finishReason ?? "stop"
    };
  }

  async *streamResponse(requestId: string): AsyncGenerator<GatewayResponseChunk> {
    this._validator.validateStreamingResponse(requestId);
    yield { requestId, chunkIndex: 0, delta: "[stream placeholder]", done: true };
  }

  normalizeError(error: any, requestId: string): GatewayResponse {
    return {
      requestId,
      providerId: "error",
      model: "none",
      content: `[ERROR] ${error?.message ?? String(error)}`,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      costUsd: 0,
      latencyMs: 0,
      finishReason: "error"
    };
  }

  collectUsage(response: GatewayResponse): void {
    const record: UsageRecord = {
      requestId: response.requestId,
      providerId: response.providerId,
      promptTokens: response.promptTokens,
      completionTokens: response.completionTokens,
      totalTokens: response.totalTokens,
      costUsd: response.costUsd,
      timestamp: new Date()
    };
    this._usageRecords.push(record);
    this.trackTokens(record);
    this.trackCost(response.requestId, response.costUsd);
  }

  calculateCost(promptTokens: number, completionTokens: number, _providerId: string): number {
    const cost = (promptTokens + completionTokens) * 0.000_002;
    this._validator.validateCost(cost);
    return cost;
  }

  // ===========================================================================
  // IAuthenticationManager
  // ===========================================================================
  loadCredentials(providerId: string): AuthCredential | undefined {
    return this._credentials.get(providerId);
  }

  async refreshToken(providerId: string): Promise<AuthCredential> {
    const existing = this._credentials.get(providerId) ?? {
      providerId,
      strategy: AuthStrategy.API_KEY,
      apiKey: `refreshed-key-${providerId}`
    };
    const updated: AuthCredential = { ...existing, expiresAt: new Date(Date.now() + 3_600_000) };
    this._credentials.set(providerId, updated);
    return updated;
  }

  validateCredential(credential: AuthCredential): AuthValidationResult {
    this._validator.validateTokenExpiry(credential.expiresAt);
    if (credential.strategy === AuthStrategy.API_KEY) {
      if (!credential.apiKey || credential.apiKey.trim() === "") {
        return { valid: false, reason: "API key is empty." };
      }
      return { valid: true, maskedKey: this._maskKey(credential.apiKey) };
    }
    return { valid: true };
  }

  injectSecret(providerId: string, apiKey: string): void {
    this._validator.validateCredential(apiKey, providerId);
    this._credentials.set(providerId, { providerId, strategy: AuthStrategy.API_KEY, apiKey });
  }

  checkPermissions(providerId: string): boolean {
    const cred = this._credentials.get(providerId);
    return !!cred && this.validateCredential(cred).valid;
  }

  private _maskKey(key: string): string {
    if (key.length <= 8) return "****";
    return key.slice(0, 4) + "****" + key.slice(-4);
  }

  // ===========================================================================
  // IRetryEngine
  // ===========================================================================
  async executeWithRetry<T>(fn: () => Promise<T>, providerId: string): Promise<T> {
    const circuit = this._circuits.get(providerId);
    if (circuit?.state === CircuitBreakerState.OPEN) {
      throw new CircuitOpenException(providerId);
    }

    let lastError: any;
    for (let attempt = 1; attempt <= this._config.maxRetries + 1; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;

        if (!this._isRecoverableError(err)) {
          throw err;
        }

        const delay = this.applyBackoff(attempt);
        const retryAttempt: RetryAttempt = {
          requestId: `retry-${Date.now()}`,
          attemptNumber: attempt,
          delayMs: delay,
          error: String(err),
          timestamp: new Date()
        };
        const history = this._retryHistory.get(providerId) ?? [];
        history.push(retryAttempt);
        this._retryHistory.set(providerId, history);

        this.trackFailure({
          providerId,
          timestamp: new Date(),
          errorCode: "EXECUTION_ERROR",
          errorMessage: String(err),
          recovered: false
        });

        if (attempt <= this._config.maxRetries) {
          await this._sleep(delay);
        }
      }
    }
    throw lastError;
  }

  applyBackoff(attemptNumber: number): number {
    this._validator.validateRetryAttempt(attemptNumber);
    const delay = Math.min(1000 * Math.pow(2, attemptNumber - 1), 60_000);
    this._validator.validateBackoffDelay(delay);
    return delay;
  }

  openCircuit(providerId: string): void {
    this._circuits.set(providerId, {
      providerId,
      state: CircuitBreakerState.OPEN,
      openedAt: new Date(),
      failures: this._config.circuitBreakerThreshold,
      threshold: this._config.circuitBreakerThreshold
    });
    const health = this._health.get(providerId);
    if (health) {
      this._health.set(providerId, { ...health, healthy: false });
    }
  }

  cooldownProvider(providerId: string, durationMs: number): void {
    this._cooldowns.set(providerId, {
      providerId,
      cooldownUntil: new Date(Date.now() + durationMs),
      reason: `Cooldown applied for ${durationMs}ms.`
    });
  }

  trackFailure(entry: FailureTrackingEntry): void {
    this._failures.push(entry);
    const health = this._health.get(entry.providerId);
    if (health) {
      this._health.set(entry.providerId, {
        ...health,
        failureCount: health.failureCount + 1,
        consecutiveFails: health.consecutiveFails + 1
      });
    }

    // Auto-open circuit if threshold exceeded
    const updated = this._health.get(entry.providerId);
    if (updated && updated.consecutiveFails >= this._config.circuitBreakerThreshold) {
      this.openCircuit(entry.providerId);
    }
  }

  getCircuitStatus(providerId: string): CircuitBreakerStatus {
    return this._circuits.get(providerId) ?? {
      providerId,
      state: CircuitBreakerState.CLOSED,
      failures: 0,
      threshold: this._config.circuitBreakerThreshold
    };
  }

  getRetryHistory(requestId: string): RetryAttempt[] {
    return this._retryHistory.get(requestId) ?? [];
  }

  private _sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ===========================================================================
  // IUsageMonitor
  // ===========================================================================
  trackTokens(record: UsageRecord): void {
    this._validator.validateUsageRecord(record.costUsd, record.requestId);
    // accumulate per provider
    const prev = this._requestCounts.get(record.providerId) ?? 0;
    this._requestCounts.set(record.providerId, prev);
  }

  trackCost(requestId: string, costUsd: number): void {
    this._validator.validateUsageRecord(costUsd, requestId);
    this._totalCostUsd += costUsd;
  }

  countRequest(providerId: string): void {
    const prev = this._requestCounts.get(providerId) ?? 0;
    this._requestCounts.set(providerId, prev + 1);
    this._loadBalancer.requestCounts[providerId] = (this._loadBalancer.requestCounts[providerId] ?? 0) + 1;
  }

  checkRateLimit(providerId: string): RateLimitStatus {
    this._validator.validateRateLimit(60);
    const used = this._requestCounts.get(providerId) ?? 0;
    return {
      providerId,
      requestsPerMinute: 60,
      remaining: Math.max(0, 60 - used),
      resetAt: new Date(Date.now() + 60_000)
    };
  }

  checkDailyQuota(providerId: string): DailyQuotaStatus {
    this._validator.validateDailyQuota(1_000, 1_000_000);
    const used = this._requestCounts.get(providerId) ?? 0;
    const date = new Date().toISOString().split("T")[0];
    return {
      providerId,
      date,
      requestCount: used,
      tokenCount: this._usageRecords
        .filter(r => r.providerId === providerId)
        .reduce((sum, r) => sum + r.totalTokens, 0),
      costUsd: this._usageRecords
        .filter(r => r.providerId === providerId)
        .reduce((sum, r) => sum + r.costUsd, 0),
      requestLimit: 1_000,
      tokenLimit: 1_000_000,
      costLimitUsd: 50
    };
  }

  getTotalUsage(): UsageRecord[] {
    return [...this._usageRecords];
  }

  getTotalCostUsd(): number {
    return this._totalCostUsd;
  }

  // ===========================================================================
  // IGatewayValidator
  // ===========================================================================
  validate(snapshot: GatewaySnapshot): void {
    this._validator.validate(snapshot);
  }

  // ===========================================================================
  // IGatewayReporter
  // ===========================================================================
  async generateReport(): Promise<GatewayReport> {
    const totalRequests = this._usageRecords.length;
    const totalCostUsd  = this._totalCostUsd;
    const totalLatency  = this._usageRecords.reduce((s, r) => s, 0);
    const avgLatencyMs  = totalRequests > 0 ? totalLatency / totalRequests : 0;

    const breakdown: Record<string, number> = {};
    for (const [pid, count] of this._requestCounts.entries()) {
      breakdown[pid] = count;
    }

    const errorCount = this._failures.filter(f => !f.recovered).length;

    return {
      generatedAt: new Date(),
      totalRequests,
      totalCostUsd,
      averageLatencyMs: avgLatencyMs,
      providerBreakdown: breakdown,
      errorRate: totalRequests > 0 ? errorCount / totalRequests : 0
    };
  }

  // ===========================================================================
  // Sub-manager resolver delegation
  // ===========================================================================
  getRegistry(): IProviderRegistry     { return this; }
  getRouter(): IRequestRouter          { return this; }
  getResponseManager(): IResponseManager { return this; }
  getAuthManager(): IAuthenticationManager { return this; }
  getRetryEngine(): IRetryEngine        { return this; }
  getUsageMonitor(): IUsageMonitor      { return this; }
  getValidator(): IGatewayValidator     { return this; }
  getReporter(): IGatewayReporter       { return this; }

  getAdapter(providerId: string): IProviderAdapter | undefined {
    return this._adapters.get(providerId);
  }

  // ===========================================================================
  // Private — register all built-in provider adapters
  // ===========================================================================
  private _registerBuiltInProviders(): void {
    let primary = "gemini";
    let fallbacks = ["nvidia", "openai", "ollama"];
    let imagePrimary = "gemini-image";
    let imageFallbacks = ["nvidia-image", "openai-image"];
    let videoPrimary = "gemini-video";
    let videoFallbacks = ["runway-video", "pika-video", "luma-video", "openai-video"];
    let voicePrimary = "gemini-voice";
    let voiceFallbacks = ["elevenlabs-voice", "openai-voice"];

    if (this._context) {
      try {
        const configEngine = this._context.resolve("IConfiguration");
        if (configEngine && typeof configEngine.getEnvironmentManager === "function") {
          const envMgr = configEngine.getEnvironmentManager();
          primary = envMgr.resolveVariable("PRIMARY_PROVIDER") || primary;
          const fallbackStr = envMgr.resolveVariable("FALLBACK_PROVIDERS");
          if (fallbackStr) {
            fallbacks = fallbackStr.split(",").map((s: string) => s.trim().toLowerCase());
          }

          const imgPrimaryStr = envMgr.resolveVariable("IMAGE_PRIMARY_PROVIDER");
          if (imgPrimaryStr) {
            imagePrimary = imgPrimaryStr.endsWith("-image") ? imgPrimaryStr : `${imgPrimaryStr}-image`;
          }
          const imgFallbackStr = envMgr.resolveVariable("IMAGE_FALLBACK_PROVIDERS");
          if (imgFallbackStr) {
            imageFallbacks = imgFallbackStr.split(",").map((s: string) => {
              const cleaned = s.trim().toLowerCase();
              return cleaned.endsWith("-image") ? cleaned : `${cleaned}-image`;
            });
          }

          const vidPrimaryStr = envMgr.resolveVariable("VIDEO_PRIMARY_PROVIDER");
          if (vidPrimaryStr) {
            videoPrimary = vidPrimaryStr.endsWith("-video") ? vidPrimaryStr : `${vidPrimaryStr}-video`;
          }
          const vidFallbackStr = envMgr.resolveVariable("VIDEO_FALLBACK_PROVIDERS");
          if (vidFallbackStr) {
            videoFallbacks = vidFallbackStr.split(",").map((s: string) => {
              const cleaned = s.trim().toLowerCase();
              return cleaned.endsWith("-video") ? cleaned : `${cleaned}-video`;
            });
          }

          const voicePrimaryStr = envMgr.resolveVariable("VOICE_PRIMARY_PROVIDER");
          if (voicePrimaryStr) {
            voicePrimary = voicePrimaryStr.endsWith("-voice") ? voicePrimaryStr : `${voicePrimaryStr}-voice`;
          }
          const voiceFallbackStr = envMgr.resolveVariable("VOICE_FALLBACK_PROVIDERS");
          if (voiceFallbackStr) {
            voiceFallbacks = voiceFallbackStr.split(",").map((s: string) => {
              const cleaned = s.trim().toLowerCase();
              return cleaned.endsWith("-voice") ? cleaned : `${cleaned}-voice`;
            });
          }
        }
      } catch (e) {
        primary = process.env.PRIMARY_PROVIDER || primary;
        if (process.env.FALLBACK_PROVIDERS) {
          fallbacks = process.env.FALLBACK_PROVIDERS.split(",").map((s: string) => s.trim().toLowerCase());
        }

        const imgPrimaryStr = process.env.IMAGE_PRIMARY_PROVIDER;
        if (imgPrimaryStr) {
          imagePrimary = imgPrimaryStr.endsWith("-image") ? imgPrimaryStr : `${imgPrimaryStr}-image`;
        }
        const imgFallbackStr = process.env.IMAGE_FALLBACK_PROVIDERS;
        if (imgFallbackStr) {
          imageFallbacks = imgFallbackStr.split(",").map((s: string) => {
            const cleaned = s.trim().toLowerCase();
            return cleaned.endsWith("-image") ? cleaned : `${cleaned}-image`;
          });
        }

        const vidPrimaryStr = process.env.VIDEO_PRIMARY_PROVIDER;
        if (vidPrimaryStr) {
          videoPrimary = vidPrimaryStr.endsWith("-video") ? vidPrimaryStr : `${vidPrimaryStr}-video`;
        }
        const vidFallbackStr = process.env.VIDEO_FALLBACK_PROVIDERS;
        if (vidFallbackStr) {
          videoFallbacks = vidFallbackStr.split(",").map((s: string) => {
            const cleaned = s.trim().toLowerCase();
            return cleaned.endsWith("-video") ? cleaned : `${cleaned}-video`;
          });
        }

        const voicePrimaryStr = process.env.VOICE_PRIMARY_PROVIDER;
        if (voicePrimaryStr) {
          voicePrimary = voicePrimaryStr.endsWith("-voice") ? voicePrimaryStr : `${voicePrimaryStr}-voice`;
        }
        const voiceFallbackStr = process.env.VOICE_FALLBACK_PROVIDERS;
        if (voiceFallbackStr) {
          voiceFallbacks = voiceFallbackStr.split(",").map((s: string) => {
            const cleaned = s.trim().toLowerCase();
            return cleaned.endsWith("-voice") ? cleaned : `${cleaned}-voice`;
          });
        }
      }
    } else {
      primary = process.env.PRIMARY_PROVIDER || primary;
      if (process.env.FALLBACK_PROVIDERS) {
        fallbacks = process.env.FALLBACK_PROVIDERS.split(",").map((s: string) => s.trim().toLowerCase());
      }

      const imgPrimaryStr = process.env.IMAGE_PRIMARY_PROVIDER;
      if (imgPrimaryStr) {
        imagePrimary = imgPrimaryStr.endsWith("-image") ? imgPrimaryStr : `${imgPrimaryStr}-image`;
      }
      const imgFallbackStr = process.env.IMAGE_FALLBACK_PROVIDERS;
      if (imgFallbackStr) {
        imageFallbacks = imgFallbackStr.split(",").map((s: string) => {
          const cleaned = s.trim().toLowerCase();
          return cleaned.endsWith("-image") ? cleaned : `${cleaned}-image`;
        });
      }

      const vidPrimaryStr = process.env.VIDEO_PRIMARY_PROVIDER;
      if (vidPrimaryStr) {
        videoPrimary = vidPrimaryStr.endsWith("-video") ? vidPrimaryStr : `${vidPrimaryStr}-video`;
      }
      const vidFallbackStr = process.env.VIDEO_FALLBACK_PROVIDERS;
      if (vidFallbackStr) {
        videoFallbacks = vidFallbackStr.split(",").map((s: string) => {
          const cleaned = s.trim().toLowerCase();
          return cleaned.endsWith("-video") ? cleaned : `${cleaned}-video`;
        });
      }

      const voicePrimaryStr = process.env.VOICE_PRIMARY_PROVIDER;
      if (voicePrimaryStr) {
        voicePrimary = voicePrimaryStr.endsWith("-voice") ? voicePrimaryStr : `${voicePrimaryStr}-voice`;
      }
      const voiceFallbackStr = process.env.VOICE_FALLBACK_PROVIDERS;
      if (voiceFallbackStr) {
        voiceFallbacks = voiceFallbackStr.split(",").map((s: string) => {
          const cleaned = s.trim().toLowerCase();
          return cleaned.endsWith("-voice") ? cleaned : `${cleaned}-voice`;
        });
      }
    }

    const priorityOrder = [primary, ...fallbacks];
    const imagePriorityOrder = [imagePrimary, ...imageFallbacks];
    const videoPriorityOrder = [videoPrimary, ...videoFallbacks];
    const voicePriorityOrder = [voicePrimary, ...voiceFallbacks];

    const builtIns: Array<{ id: string; type: ProviderAdapterType; name: string; models: string[]; priority: number }> = [
      { id: "openai",      type: ProviderAdapterType.OPENAI,      name: "OpenAI",      models: ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"],         priority: 100 },
      { id: "gemini",      type: ProviderAdapterType.GEMINI,      name: "Gemini",      models: ["gemini-2.0-flash", "gemini-1.5-pro"],              priority: 90  },
      { id: "nvidia",      type: ProviderAdapterType.NVIDIA,      name: "Nvidia",      models: ["nvidia/llama-3.1-70b-instruct"],                   priority: 85  },
      { id: "openrouter",  type: ProviderAdapterType.OPENROUTER,  name: "OpenRouter",  models: ["anthropic/claude-3.5-sonnet", "meta-llama/llama-3"], priority: 80  },
      { id: "grok",        type: ProviderAdapterType.GROK,        name: "Grok",        models: ["grok-2", "grok-2-mini"],                           priority: 75  },
      { id: "huggingface", type: ProviderAdapterType.HUGGINGFACE, name: "HuggingFace", models: ["mistralai/Mistral-7B-Instruct-v0.3"],              priority: 70  },
      { id: "ollama",      type: ProviderAdapterType.OLLAMA,      name: "Ollama",      models: ["llama3.2", "mistral", "phi3"],                     priority: 60  },
      { id: "tavily",      type: ProviderAdapterType.TAVILY,      name: "Tavily",      models: ["tavily-search-basic", "tavily-search-advanced"],   priority: 50  },
      { id: "youtube",     type: ProviderAdapterType.YOUTUBE,     name: "YouTube",     models: ["youtube-data-v3"],                                 priority: 40  },
      { id: "instagram",   type: ProviderAdapterType.INSTAGRAM,   name: "Instagram",   models: ["instagram-graph-v18"],                             priority: 30  },
      { id: "facebook",    type: ProviderAdapterType.FACEBOOK,    name: "Facebook",    models: ["facebook-graph-v18"],                              priority: 20  },
      { id: "gemini-image", type: ProviderAdapterType.GEMINI_IMAGE, name: "Gemini Image", models: [process.env.IMAGE_PROVIDER_MODEL || "gemini-2.5-flash-image-preview"], priority: 95 },
      { id: "nvidia-image", type: ProviderAdapterType.NVIDIA_IMAGE, name: "Nvidia Image", models: ["nvidia-image-model"], priority: 85 },
      { id: "openai-image", type: ProviderAdapterType.OPENAI_IMAGE, name: "OpenAI Image", models: ["dall-e-3"], priority: 80 },
      { id: "gemini-video", type: ProviderAdapterType.GEMINI_VIDEO, name: "Gemini Video", models: [process.env.VIDEO_PROVIDER_MODEL || "veo-3"], priority: 95 },
      { id: "runway-video", type: ProviderAdapterType.RUNWAY_VIDEO, name: "Runway Video", models: ["runway-video-model"], priority: 85 },
      { id: "pika-video", type: ProviderAdapterType.PIKA_VIDEO, name: "Pika Video", models: ["pika-video-model"], priority: 80 },
      { id: "luma-video", type: ProviderAdapterType.LUMA_VIDEO, name: "Luma Video", models: ["luma-video-model"], priority: 75 },
      { id: "openai-video", type: ProviderAdapterType.OPENAI_VIDEO, name: "OpenAI Video", models: ["openai-video-model"], priority: 70 },
      { id: "gemini-voice", type: ProviderAdapterType.GEMINI_VOICE, name: "Gemini Voice", models: [process.env.VOICE_TTS_MODEL || "gemini-tts-1", process.env.VOICE_STT_MODEL || "gemini-stt-1"], priority: 95 },
      { id: "elevenlabs-voice", type: ProviderAdapterType.ELEVENLABS_VOICE, name: "ElevenLabs Voice", models: [process.env.ELEVENLABS_MODEL || "eleven_monolingual_v1"], priority: 85 },
      { id: "openai-voice", type: ProviderAdapterType.OPENAI_VOICE, name: "OpenAI Voice", models: [process.env.OPENAI_TTS_MODEL || "tts-1", process.env.OPENAI_STT_MODEL || "whisper-1"], priority: 80 }
    ];

    for (const bi of builtIns) {
      const adapter = new BuiltInAdapter(bi.id, bi.type, this._context);
      this._adapters.set(bi.id, adapter);

      // Dynamically calculate priority
      let calculatedPriority = bi.priority;
      if (bi.id.endsWith("-image")) {
        const index = imagePriorityOrder.indexOf(bi.id);
        if (index !== -1) {
          calculatedPriority = 1000 - index * 100;
        }
      } else if (bi.id.endsWith("-video")) {
        const index = videoPriorityOrder.indexOf(bi.id);
        if (index !== -1) {
          calculatedPriority = 1000 - index * 100;
        }
      } else if (bi.id.endsWith("-voice")) {
        const index = voicePriorityOrder.indexOf(bi.id);
        if (index !== -1) {
          calculatedPriority = 1000 - index * 100;
        }
      } else {
        const index = priorityOrder.indexOf(bi.id);
        if (index !== -1) {
          calculatedPriority = 1000 - index * 100;
        }
      }

      const entry: ProviderRegistryEntry = {
        providerId: bi.id,
        adapterType: bi.type,
        displayName: bi.name,
        capabilities: {
          supportsStreaming: !bi.id.endsWith("-image") && !bi.id.endsWith("-video") && !bi.id.endsWith("-voice"),
          supportsVision: bi.type === ProviderAdapterType.OPENAI || bi.type === ProviderAdapterType.GEMINI || bi.type === ProviderAdapterType.NVIDIA,
          supportsTools: bi.type === ProviderAdapterType.OPENAI || bi.type === ProviderAdapterType.GEMINI || bi.type === ProviderAdapterType.GROK,
          supportsJsonMode: bi.type === ProviderAdapterType.OPENAI || bi.type === ProviderAdapterType.OPENROUTER || bi.type === ProviderAdapterType.GROK,
          maxContextTokens: bi.type === ProviderAdapterType.OLLAMA ? 32_768 : 128_000,
          availableModels: bi.models,
          supportsChat: !bi.id.endsWith("-image") && !bi.id.endsWith("-video") && !bi.id.endsWith("-voice"),
          supportsImages: bi.id.endsWith("-image"),
          supportsVideo: bi.id.endsWith("-video"),
          supportsVoice: bi.id.endsWith("-voice"),
          supportsEmbeddings: !bi.id.endsWith("-image") && !bi.id.endsWith("-video") && !bi.id.endsWith("-voice") && (bi.type === ProviderAdapterType.GEMINI || bi.type === ProviderAdapterType.OPENAI || bi.type === ProviderAdapterType.OLLAMA)
        },
        priority: calculatedPriority,
        enabled: true,
        version: "1.0.0"
      };

      this.registerProvider(entry);
    }
  }
}
