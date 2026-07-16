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
import { GeminiConfiguration } from "./GeminiConfiguration";
import { GeminiContext } from "./GeminiContext";
import { GeminiModels } from "./GeminiModels";
import { GeminiValidator } from "./GeminiValidator";
import { GeminiCapabilities } from "./GeminiCapabilities";

export class GeminiProvider extends Provider {
  private readonly _transport: IProviderTransport;
  private readonly _models: typeof GeminiModels = GeminiModels;

  constructor(
    id: string,
    name: string,
    context: GeminiContext,
    configuration: GeminiConfiguration,
    metadata?: Record<string, any>,
    transport?: IProviderTransport
  ) {
    super(
      id,
      name,
      ProviderType.CHAT,
      GeminiCapabilities,
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
  }

  public get models(): readonly ModelDescriptor[] {
    return this._models;
  }

  private mapMessages(messages: any[]): any[] {
    return messages.map((msg) => {
      let role = msg.role;
      if (role === "assistant") role = "model";
      if (role === "system") role = "user";
      return {
        role,
        parts: [{ text: msg.content || "" }]
      };
    });
  }

  protected async performExecute(request: ProviderRequest): Promise<ProviderResponse> {
    GeminiValidator.validateRequest(request);

    const model = request.model || "gemini-1.5-flash";
    const isEmbedding = model.includes("embedding") || (!request.messages && request.prompt);

    if (isEmbedding) {
      const body = {
        content: {
          parts: [{ text: request.prompt || request.messages?.map((m: any) => m.content).join("\n") || "" }]
        }
      };

      const response = await this._transport.execute({
        id: `req-${Date.now()}`,
        url: `${this._transport.baseUrl}/models/${model}:embedContent`,
        method: "POST",
        body,
      });

      const embeddingValues = response.body.embedding?.values || [];
      return {
        responseId: `resp-${Date.now()}`,
        providerId: this.id,
        model,
        content: JSON.stringify(embeddingValues),
        text: JSON.stringify(embeddingValues),
        latency: response.latency,
      };
    }

    const messages = request.messages || [{ role: "user", content: request.prompt || "" }];
    const systemMsg = messages.find((m: any) => m.role === "system");
    const contents = this.mapMessages(messages.filter((m: any) => m.role !== "system"));

    const body: any = {
      contents,
      generationConfig: {
        temperature: request.temperature,
        maxOutputTokens: request.maxTokens,
      }
    };

    if (systemMsg) {
      body.systemInstruction = {
        parts: [{ text: systemMsg.content }]
      };
    }

    const response = await this._transport.execute({
      id: `req-${Date.now()}`,
      url: `${this._transport.baseUrl}/models/${model}:generateContent`,
      method: "POST",
      body,
    });

    const candidate = response.body.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text || "";

    return {
      responseId: `resp-${Date.now()}`,
      providerId: this.id,
      model,
      content: text,
      text,
      latency: response.latency,
      usage: response.body.usageMetadata ? {
        promptTokens: response.body.usageMetadata.promptTokenCount,
        completionTokens: response.body.usageMetadata.candidatesTokenCount,
        totalTokens: response.body.usageMetadata.totalTokenCount,
      } : undefined,
      finishReason: candidate?.finishReason || "STOP",
    };
  }

  protected async *performStream(request: ProviderRequest): AsyncGenerator<ProviderResponseChunk> {
    GeminiValidator.validateRequest(request);

    const model = request.model || "gemini-1.5-flash";
    const messages = request.messages || [{ role: "user", content: request.prompt || "" }];
    const systemMsg = messages.find((m: any) => m.role === "system");
    const contents = this.mapMessages(messages.filter((m: any) => m.role !== "system"));

    const body: any = {
      contents,
      generationConfig: {
        temperature: request.temperature,
        maxOutputTokens: request.maxTokens,
      }
    };

    if (systemMsg) {
      body.systemInstruction = {
        parts: [{ text: systemMsg.content }]
      };
    }

    // Google Gemini uses alt=sse for Server-Sent Events stream
    const streamGenerator = this._transport.stream({
      id: `stream-${Date.now()}`,
      url: `${this._transport.baseUrl}/models/${model}:streamGenerateContent?alt=sse`,
      method: "POST",
      body,
    });

    for await (const chunk of streamGenerator) {
      const candidate = chunk.body.candidates?.[0];
      const content = candidate?.content?.parts?.[0]?.text || "";
      yield {
        chunkId: `chunk-${Date.now()}`,
        content,
        finishReason: candidate?.finishReason || undefined,
        usage: chunk.body.usageMetadata ? {
          promptTokens: chunk.body.usageMetadata.promptTokenCount,
          completionTokens: chunk.body.usageMetadata.candidatesTokenCount,
          totalTokens: chunk.body.usageMetadata.totalTokenCount,
        } : undefined,
      };
    }
  }
}
