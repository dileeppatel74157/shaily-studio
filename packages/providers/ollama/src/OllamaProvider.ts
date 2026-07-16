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
import { OllamaConfiguration } from "./OllamaConfiguration";
import { OllamaContext } from "./OllamaContext";
import { OllamaModels } from "./OllamaModels";
import { OllamaValidator } from "./OllamaValidator";
import { OllamaCapabilities } from "./OllamaCapabilities";

export class OllamaProvider extends Provider {
  private readonly _transport: IProviderTransport;
  private readonly _models: typeof OllamaModels = OllamaModels;

  constructor(
    id: string,
    name: string,
    context: OllamaContext,
    configuration: OllamaConfiguration,
    metadata?: Record<string, any>,
    transport?: IProviderTransport
  ) {
    super(
      id,
      name,
      ProviderType.CHAT,
      OllamaCapabilities,
      context,
      configuration,
      metadata || {}
    );

    const baseUrl = configuration.baseUrl || "http://localhost:11434";

    this._transport = transport || new TransportBuilder()
      .withId(`${id}-transport`)
      .withBaseUrl(baseUrl)
      .withHeader("Content-Type", "application/json")
      .withContext({ env: context.env || "dev", namespace: context.namespace || "default", logger: context.logger })
      .build();
  }

  public get models(): readonly ModelDescriptor[] {
    return this._models;
  }

  protected async performExecute(request: ProviderRequest): Promise<ProviderResponse> {
    OllamaValidator.validateRequest(request);

    const model = request.model || "llama3";
    const isEmbedding = model.includes("embed") || (!request.messages && request.prompt);

    if (isEmbedding) {
      const body = {
        model,
        prompt: request.prompt || request.messages?.map((m: any) => m.content).join("\n") || "",
      };

      const response = await this._transport.execute({
        id: `req-${Date.now()}`,
        url: `${this._transport.baseUrl}/api/embeddings`,
        method: "POST",
        body,
      });

      const embeddingValues = response.body.embedding || [];
      return {
        responseId: `resp-${Date.now()}`,
        providerId: this.id,
        model,
        content: JSON.stringify(embeddingValues),
        text: JSON.stringify(embeddingValues),
        latency: response.latency,
      };
    }

    const body = {
      model,
      messages: request.messages || [{ role: "user", content: request.prompt || "" }],
      stream: false,
      options: {
        temperature: request.temperature,
      },
    };

    const response = await this._transport.execute({
      id: `req-${Date.now()}`,
      url: `${this._transport.baseUrl}/api/chat`,
      method: "POST",
      body,
    });

    const msg = response.body.message;
    const text = msg?.content || "";

    return {
      responseId: `resp-${Date.now()}`,
      providerId: this.id,
      model,
      content: text,
      text,
      latency: response.latency,
      usage: response.body.prompt_eval_count ? {
        promptTokens: response.body.prompt_eval_count,
        completionTokens: response.body.eval_count || 0,
        totalTokens: (response.body.prompt_eval_count + (response.body.eval_count || 0)),
      } : undefined,
      finishReason: response.body.done ? "stop" : undefined,
    };
  }

  protected async *performStream(request: ProviderRequest): AsyncGenerator<ProviderResponseChunk> {
    OllamaValidator.validateRequest(request);

    const model = request.model || "llama3";
    const body = {
      model,
      messages: request.messages || [{ role: "user", content: request.prompt || "" }],
      stream: true,
      options: {
        temperature: request.temperature,
      },
    };

    const streamGenerator = this._transport.stream({
      id: `stream-${Date.now()}`,
      url: `${this._transport.baseUrl}/api/chat`,
      method: "POST",
      body,
    });

    for await (const chunk of streamGenerator) {
      const msg = chunk.body.message;
      const content = msg?.content || "";
      yield {
        chunkId: `chunk-${Date.now()}`,
        content,
        finishReason: chunk.body.done ? "stop" : undefined,
        usage: chunk.body.prompt_eval_count ? {
          promptTokens: chunk.body.prompt_eval_count,
          completionTokens: chunk.body.eval_count || 0,
          totalTokens: (chunk.body.prompt_eval_count + (chunk.body.eval_count || 0)),
        } : undefined,
      };
    }
  }

  public async *pullModel(modelName: string): AsyncGenerator<{ status: string; completed?: number; total?: number }> {
    const streamGenerator = this._transport.stream({
      id: `pull-${Date.now()}`,
      url: `${this._transport.baseUrl}/api/pull`,
      method: "POST",
      body: { name: modelName },
    });

    for await (const chunk of streamGenerator) {
      yield {
        status: chunk.body.status || "pulling",
        completed: chunk.body.completed,
        total: chunk.body.total,
      };
    }
  }
}
