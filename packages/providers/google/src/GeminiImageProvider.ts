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
import { GeminiImageConfiguration } from "./GeminiImageConfiguration";
import { GeminiContext } from "./GeminiContext";
import { GeminiImageModels } from "./GeminiImageModels";
import { GeminiImageValidator } from "./GeminiImageValidator";
import { GeminiImageCapabilities } from "./GeminiImageCapabilities";

export class GeminiImageProvider extends Provider {
  private readonly _transport: IProviderTransport;
  private readonly _models: typeof GeminiImageModels = GeminiImageModels;
  private readonly _storage: any;

  constructor(
    id: string,
    name: string,
    context: GeminiContext,
    configuration: GeminiImageConfiguration,
    metadata?: Record<string, any>,
    transport?: IProviderTransport
  ) {
    super(
      id,
      name,
      ProviderType.IMAGE,
      GeminiImageCapabilities,
      context,
      configuration,
      metadata || {}
    );

    const apiKey = configuration.apiKey;
    const baseUrl = configuration.baseUrl || "https://generativelanguage.googleapis.com/v1beta";

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
    GeminiImageValidator.validateRequest(request);

    const model = request.model || "gemini-2.5-flash-image-preview";
    
    // Map request properties
    const negativePrompt = (request as any).negativePrompt;
    const width = (request as any).width;
    const height = (request as any).height;
    const numberOfImages = (request as any).numberOfImages || 1;
    const seed = (request as any).seed;
    const mimeType = (request as any).mimeType || "image/png";

    // Build aspect ratio if possible
    let aspectRatio: string | undefined;
    if (width && height) {
      const ratio = width / height;
      if (Math.abs(ratio - 1) < 0.1) aspectRatio = "1:1";
      else if (Math.abs(ratio - 4/3) < 0.1) aspectRatio = "4:3";
      else if (Math.abs(ratio - 3/4) < 0.1) aspectRatio = "3:4";
      else if (Math.abs(ratio - 16/9) < 0.1) aspectRatio = "16:9";
      else if (Math.abs(ratio - 9/16) < 0.1) aspectRatio = "9:16";
    }

    const parameters: Record<string, any> = {
      sampleCount: numberOfImages,
    };
    if (aspectRatio) {
      parameters.aspectRatio = aspectRatio;
    }
    if (negativePrompt) {
      parameters.negativePrompt = negativePrompt;
    }
    if (mimeType) {
      parameters.outputMimeType = mimeType;
    }
    if (seed !== undefined) {
      parameters.seed = seed;
    }

    const body = {
      instances: [
        {
          prompt: request.prompt,
        }
      ],
      parameters,
    };

    const response = await this._transport.execute({
      id: `req-${Date.now()}`,
      url: `${this._transport.baseUrl}/models/${model}:predict`,
      method: "POST",
      body,
    });

    const predictions = response.body.predictions || [];
    if (predictions.length === 0) {
      throw new Error("No predictions returned from Gemini Image API.");
    }

    const prediction = predictions[0];
    const base64Bytes = prediction.bytesBase64Encoded;
    if (!base64Bytes) {
      throw new Error("No image bytes returned in predictions.");
    }

    const imageBuffer = Buffer.from(base64Bytes, "base64");
    
    // Save image via Storage Provider if available
    const bucketId = process.env.STORAGE_BUCKET_IMAGES || "images";
    const extension = mimeType.split("/")[1] || "png";
    const imageId = `image-${Date.now()}-${Math.floor(Math.random() * 10000)}.${extension}`;
    const storedImagePath = `${bucketId}/${imageId}`;

    if (this._storage) {
      if (typeof this._storage.hasBucket === "function" && !this._storage.hasBucket(bucketId)) {
        await this._storage.createBucket({
          id: bucketId,
          name: bucketId,
          description: "Images Bucket",
          created: new Date()
        });
      }
      await this._storage.putObject(bucketId, {
        id: imageId,
        bucketId,
        content: imageBuffer,
        metadata: {
          contentType: mimeType,
          size: imageBuffer.length,
          created: new Date(),
          updated: new Date(),
          custom: {
            prompt: request.prompt || "",
            model,
            provider: this.id
          }
        }
      });
    }

    return {
      responseId: `resp-${Date.now()}`,
      providerId: this.id,
      model,
      content: storedImagePath,
      text: storedImagePath,
      latency: response.latency,
      // Custom response model fields
      generationTime: response.latency,
      metadata: {
        width,
        height,
        mimeType,
        seed,
        predictions: predictions.map((p: any) => ({ mimeType: p.mimeType }))
      },
      storedImagePath,
      storageBucket: bucketId,
      mimeType,
      width,
      height
    } as any;
  }

  protected async *performStream(request: ProviderRequest): AsyncGenerator<ProviderResponseChunk> {
    throw new Error("Streaming not supported for Gemini Image Generation.");
  }
}
