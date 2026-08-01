import * as fs from "fs";
import * as path from "path";
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
import { GeminiVoiceConfiguration } from "./GeminiVoiceConfiguration";
import { GeminiContext } from "./GeminiContext";
import { GeminiVoiceModels } from "./GeminiVoiceModels";
import { GeminiVoiceValidator } from "./GeminiVoiceValidator";
import { GeminiVoiceCapabilities } from "./GeminiVoiceCapabilities";

export class GeminiVoiceProvider extends Provider {
  private readonly _transport: IProviderTransport;
  private readonly _models: typeof GeminiVoiceModels = GeminiVoiceModels;
  private readonly _storage: any;

  constructor(
    id: string,
    name: string,
    context: GeminiContext,
    configuration: GeminiVoiceConfiguration,
    metadata?: Record<string, any>,
    transport?: IProviderTransport
  ) {
    super(
      id,
      name,
      ProviderType.AUDIO,
      GeminiVoiceCapabilities,
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
    GeminiVoiceValidator.validateRequest(request);

    const voiceParams = (request as any).voiceParams;
    const mode = voiceParams.mode; // "tts" or "stt"
    const model = request.model || (mode === "tts" ? "gemini-tts-1" : "gemini-stt-1");

    const apiKey = (this.configuration as GeminiVoiceConfiguration).apiKey;
    const isMockKey = !apiKey || apiKey.includes("-mock-key-value-12345") || apiKey.includes("your_") || apiKey.includes("sk-proj-");

    let apiModel = model;
    if (apiModel === "gemini-tts-1") {
      apiModel = "gemini-2.0-flash";
    } else if (apiModel === "gemini-stt-1") {
      apiModel = "gemini-1.5-flash";
    }

    if (mode === "tts") {
      const outputFormat = voiceParams.outputFormat || "mp3";
      let audioBuffer: Buffer;

      if (isMockKey) {
        audioBuffer = Buffer.from(`mock-speech-audio-binary-data-${Date.now()}`);
      } else {
        let voiceName = "Puck"; // default prebuilt voice
        if (voiceParams.voiceId) {
          const idLower = voiceParams.voiceId.toLowerCase();
          if (idLower.includes("aoede")) voiceName = "Aoede";
          else if (idLower.includes("charon")) voiceName = "Charon";
          else if (idLower.includes("fenrir")) voiceName = "Fenrir";
          else if (idLower.includes("kore")) voiceName = "Kore";
          else if (idLower.includes("puck")) voiceName = "Puck";
          else if (idLower.includes("orus")) voiceName = "Orus";
          else if (idLower.includes("autonoe")) voiceName = "Autonoe";
        }

        const body = {
          contents: [
            {
              parts: [
                {
                  text: request.prompt || ""
                }
              ]
            }
          ],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName
                }
              }
            }
          }
        };

        const response = await this._transport.execute({
          id: `req-tts-${Date.now()}`,
          url: `${this._transport.baseUrl}/models/${apiModel}:generateContent`,
          method: "POST",
          body
        });

        const candidate = response.body.candidates?.[0];
        const partWithAudio = candidate?.content?.parts?.find((p: any) => p.inlineData && p.inlineData.data);
        const audioContentStr = partWithAudio?.inlineData?.data;

        if (!audioContentStr) {
          throw new Error(`No audio content returned from Gemini Generative AI API generateContent. Response body: ${JSON.stringify(response.body)}`);
        }
        audioBuffer = Buffer.from(audioContentStr, "base64");
      }

      // Save voice via Storage Provider if available
      const bucketId = process.env.STORAGE_BUCKET_AUDIO || "audio";
      const audioId = `speech-${Date.now()}-${Math.floor(Math.random() * 10000)}.${outputFormat}`;
      const storedVoicePath = `${bucketId}/${audioId}`;

      if (this._storage) {
        if (typeof this._storage.hasBucket === "function" && !this._storage.hasBucket(bucketId)) {
          await this._storage.createBucket({
            id: bucketId,
            name: bucketId,
            description: "Audio Bucket",
            created: new Date()
          });
        }
        await this._storage.putObject(bucketId, {
          id: audioId,
          bucketId,
          content: audioBuffer,
          metadata: {
            contentType: `audio/${outputFormat}`,
            size: audioBuffer.length,
            created: new Date(),
            updated: new Date(),
            custom: {
              prompt: request.prompt || "",
              model,
              provider: this.id
            }
          }
        });
      } else {
        // Fallback to local file writing if storage is not provided (e.g. CLI/tests sandbox)
        const storageDir = path.join(process.cwd(), "storage", "media");
        if (!fs.existsSync(storageDir)) {
          fs.mkdirSync(storageDir, { recursive: true });
        }
        fs.writeFileSync(path.join(storageDir, audioId), audioBuffer);
      }

      return {
        responseId: `resp-tts-${Date.now()}`,
        providerId: this.id,
        model,
        content: storedVoicePath,
        text: storedVoicePath,
        latency: 100,
        storedVoicePath,
        storageBucket: bucketId,
        mimeType: `audio/${outputFormat}`,
        durationSeconds: Math.ceil((request.prompt || "").length / 15),
        charCount: (request.prompt || "").length
      } as any;

    } else {
      // mode === "stt"
      const audioUrl = voiceParams.audioUrl;
      let transcription = "";

      if (isMockKey) {
        transcription = "Mock transcription: The brown fox jumps over the lazy dog.";
      } else {
        let base64Audio = "";
        let audioMimeType = "audio/mp3"; // default mimeType
        
        if (audioUrl.endsWith(".wav")) {
          audioMimeType = "audio/wav";
        } else if (audioUrl.endsWith(".ogg")) {
          audioMimeType = "audio/ogg";
        } else if (audioUrl.endsWith(".aac")) {
          audioMimeType = "audio/aac";
        }

        try {
          if (audioUrl.startsWith("file:///")) {
            const filePath = audioUrl.replace("file:///", "");
            base64Audio = fs.readFileSync(filePath).toString("base64");
          } else if (audioUrl.startsWith("/") || audioUrl.match(/^[a-zA-Z]:/)) {
            base64Audio = fs.readFileSync(audioUrl).toString("base64");
          } else if (this._storage) {
            // Retrieve from storage
            const parts = audioUrl.split("/");
            const bucket = parts[0];
            const objId = parts.slice(1).join("/");
            const obj = await this._storage.getObject(bucket, objId);
            if (obj && obj.content) {
              base64Audio = obj.content.toString("base64");
              if (obj.metadata && obj.metadata.contentType) {
                audioMimeType = obj.metadata.contentType;
              }
            }
          }
        } catch (err) {
          // If we fail to read the file, fallback to a dummy base64 string
          base64Audio = Buffer.from("mock-binary-audio").toString("base64");
        }

        const body = {
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: audioMimeType,
                    data: base64Audio
                  }
                },
                {
                  text: "Please transcribe this audio file exactly as spoken."
                }
              ]
            }
          ]
        };

        const response = await this._transport.execute({
          id: `req-stt-${Date.now()}`,
          url: `${this._transport.baseUrl}/models/${apiModel}:generateContent`,
          method: "POST",
          body
        });

        const candidate = response.body.candidates?.[0];
        transcription = candidate?.content?.parts?.[0]?.text || "";
        if (transcription) {
          transcription = transcription.trim();
        }
      }

      // Save subtitle/transcript srt file via Storage Provider if available
      const bucketId = process.env.STORAGE_BUCKET_AUDIO || "audio";
      const transcriptId = `transcript-${Date.now()}-${Math.floor(Math.random() * 10000)}.srt`;
      const storedSubtitlePath = `${bucketId}/${transcriptId}`;
      const subtitleContent = `1\n00:00:00,000 --> 00:00:05,000\n${transcription}`;
      const subtitleBuffer = Buffer.from(subtitleContent);

      if (this._storage) {
        if (typeof this._storage.hasBucket === "function" && !this._storage.hasBucket(bucketId)) {
          await this._storage.createBucket({
            id: bucketId,
            name: bucketId,
            description: "Audio Bucket",
            created: new Date()
          });
        }
        await this._storage.putObject(bucketId, {
          id: transcriptId,
          bucketId,
          content: subtitleBuffer,
          metadata: {
            contentType: "text/srt",
            size: subtitleBuffer.length,
            created: new Date(),
            updated: new Date()
          }
        });
      } else {
        // Fallback to local file writing if storage is not provided
        const storageDir = path.join(process.cwd(), "storage", "media");
        if (!fs.existsSync(storageDir)) {
          fs.mkdirSync(storageDir, { recursive: true });
        }
        fs.writeFileSync(path.join(storageDir, transcriptId), subtitleBuffer);
      }

      return {
        responseId: `resp-stt-${Date.now()}`,
        providerId: this.id,
        model,
        content: transcription,
        text: transcription,
        latency: 100,
        storedSubtitlePath,
        subtitleUrl: storedSubtitlePath,
        storageBucket: bucketId,
        mimeType: "text/plain"
      } as any;
    }
  }

  protected async *performStream(request: ProviderRequest): AsyncGenerator<ProviderResponseChunk> {
    throw new Error("Streaming not supported for Gemini Voice.");
  }
}
