import {
  Provider,
  ProviderRequest,
  ProviderResponse,
  ProviderResponseChunk,
  ProviderType,
  IProviderTransport,
  TransportBuilder,
  ModelDescriptor,
} from "@shaily/core";
import { GeminiVideoConfiguration } from "./GeminiVideoConfiguration";
import { GeminiContext } from "./GeminiContext";
import { GeminiVideoModels } from "./GeminiVideoModels";
import { GeminiVideoValidator } from "./GeminiVideoValidator";
import { GeminiVideoCapabilities } from "./GeminiVideoCapabilities";

export class GeminiVideoProvider extends Provider {
  private readonly _transport: IProviderTransport;
  private readonly _models: typeof GeminiVideoModels = GeminiVideoModels;
  private readonly _storage: any;

  constructor(
    id: string,
    name: string,
    context: GeminiContext,
    configuration: GeminiVideoConfiguration,
    metadata?: Record<string, any>,
    transport?: IProviderTransport
  ) {
    super(
      id,
      name,
      ProviderType.VIDEO,
      GeminiVideoCapabilities,
      context,
      configuration,
      metadata || {}
    );

    const apiKey = configuration.apiKey;
    const baseUrl = configuration.baseUrl || "https://generativelanguage.googleapis.com";

    this._transport = transport || new TransportBuilder()
      .withId(`${id}-transport`)
      .withBaseUrl(baseUrl)
      .withHeader("x-goog-api-key", apiKey)
      .withHeader("Content-Type", "application/json")
      .withContext({ env: context.env || "dev", namespace: context.namespace || "default", logger: context.logger })
      .build();

    this._storage = (context as any).storage;
  }

  public get models(): readonly ModelDescriptor[] {
    return this._models;
  }

  protected async performExecute(request: ProviderRequest): Promise<ProviderResponse> {
    GeminiVideoValidator.validateRequest(request);

    const model = request.model || process.env.VIDEO_PROVIDER_MODEL || "veo-3";
    
    // Map request properties
    const prompt = request.prompt;
    const negativePrompt = (request as any).negativePrompt;
    const duration = Number((request as any).duration || process.env.VIDEO_DEFAULT_DURATION || 8);
    const aspectRatio = (request as any).aspectRatio || process.env.VIDEO_DEFAULT_ASPECT_RATIO || "16:9";
    const resolution = (request as any).resolution || "720p";
    const fps = Number((request as any).fps || 24);
    const seed = (request as any).seed;
    const mimeType = (request as any).mimeType || process.env.VIDEO_OUTPUT_FORMAT || "video/mp4";

    const parameters: Record<string, any> = {
      sampleCount: 1,
      durationSeconds: duration,
      aspectRatio,
      resolution,
      fps,
      outputMimeType: mimeType,
    };

    if (negativePrompt) {
      parameters.negativePrompt = negativePrompt;
    }
    if (seed !== undefined && seed !== null) {
      parameters.seed = Number(seed);
    }

    const body = {
      instances: [
        {
          prompt,
        }
      ],
      parameters,
    };

    const startTime = Date.now();
    let submitRes: any;

    try {
      submitRes = await this._transport.execute({
        id: `submit-${Date.now()}`,
        url: `${this._transport.baseUrl}/v1beta/models/${model}:predictLongRunning`,
        method: "POST",
        body
      });
    } catch (err: any) {
      throw this._mapError(err);
    }

    if (!submitRes || !submitRes.body || !submitRes.body.name) {
      const errMsg = submitRes?.body?.error?.message || "Invalid response from predictLongRunning API.";
      const status = submitRes?.body?.error?.status || submitRes?.body?.error?.code || 500;
      const err = new Error(errMsg);
      (err as any).status = status;
      throw this._mapError(err);
    }

    const operationName = submitRes.body.name; // e.g. "operations/xxxx"

    // Poll the status
    let done = false;
    let operationResult: any = null;
    const pollIntervalMs = 5000;
    const timeoutMs = 300000; // 5 minutes

    while (!done) {
      if (Date.now() - startTime > timeoutMs) {
        const timeoutErr = new Error("Operation timed out waiting for video generation.");
        (timeoutErr as any).status = 408;
        throw timeoutErr;
      }

      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));

      let pollRes: any;
      try {
        pollRes = await this._transport.execute({
          id: `poll-${Date.now()}`,
          url: `${this._transport.baseUrl}/v1beta/${operationName}`,
          method: "GET"
        });
      } catch (err: any) {
        throw this._mapError(err);
      }

      const status = pollRes?.body;
      if (!status) {
        continue;
      }

      if (status.done) {
        done = true;
        if (status.error) {
          const apiErr = status.error;
          const pollErr = new Error(apiErr.message || "Video generation operation failed.");
          (pollErr as any).status = apiErr.code || 500;
          throw this._mapError(pollErr);
        }
        operationResult = status.response;
      }
    }

    const videoUri = operationResult?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) {
      throw new Error("No video URI returned in the completed operation response.");
    }

    // Download video
    const downloadUrl = videoUri.startsWith("http")
      ? `${videoUri}?alt=media`
      : `${this._transport.baseUrl}/${videoUri}?alt=media`;

    let downloadRes: any;
    try {
      downloadRes = await this._transport.execute({
        id: `dl-${Date.now()}`,
        url: downloadUrl,
        method: "GET"
      });
    } catch (err: any) {
      const dlErr = new Error(`Download failure: ${err.message}`);
      throw this._mapError(dlErr);
    }

    if (!downloadRes || !downloadRes.body) {
      throw new Error("Download failed: empty response body returned from files API.");
    }

    const videoBuffer = Buffer.isBuffer(downloadRes.body)
      ? downloadRes.body
      : Buffer.from(downloadRes.body);

    const bucketId = process.env.STORAGE_BUCKET_VIDEOS || "videos";
    const extension = mimeType.split("/")[1] || "mp4";
    const videoId = `video-${Date.now()}-${Math.floor(Math.random() * 10000)}.${extension}`;
    const storedPath = `${bucketId}/${videoId}`;

    try {
      if (this._storage) {
        if (typeof this._storage.hasBucket === "function" && !this._storage.hasBucket(bucketId)) {
          await this._storage.createBucket({
            id: bucketId,
            name: bucketId,
            description: "Videos Bucket",
            created: new Date()
          });
        }
        await this._storage.putObject(bucketId, {
          id: videoId,
          bucketId,
          content: videoBuffer,
          metadata: {
            contentType: mimeType,
            size: videoBuffer.length,
            created: new Date(),
            updated: new Date(),
            custom: {
              prompt,
              model,
              provider: this.id
            }
          }
        });
      }
    } catch (err: any) {
      const storageErr = new Error(`Storage failure: ${err.message}`);
      throw storageErr;
    }

    return {
      responseId: `resp-${Date.now()}`,
      providerId: this.id,
      model,
      content: storedPath,
      text: storedPath,
      latency: Date.now() - startTime,
      generationTime: Date.now() - startTime,
      metadata: {
        duration,
        resolution,
        mimeType,
        operationId: operationName,
        aspectRatio,
        status: "completed",
        seed
      },
      storedVideoPath: storedPath,
      storageBucket: bucketId,
      mimeType,
      duration,
      resolution
    } as any;
  }

  protected async *performStream(request: ProviderRequest): AsyncGenerator<ProviderResponseChunk> {
    throw new Error("Streaming not supported for Gemini Video Generation.");
  }

  private _mapError(err: any): Error {
    const msg = String(err.message || err).toLowerCase();
    let status = err.status || err.statusCode;

    if (msg.includes("api key not valid") || msg.includes("invalid api key")) {
      status = 401;
    } else if (msg.includes("quota exceeded") || msg.includes("quota")) {
      status = 429;
    } else if (msg.includes("rate limit") || msg.includes("exhausted") || msg.includes("resource_exhausted")) {
      status = 429;
    }

    const mapped = new Error(err.message || String(err));
    (mapped as any).status = status;
    return mapped;
  }
}
