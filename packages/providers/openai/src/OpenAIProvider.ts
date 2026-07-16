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
import { OpenAIConfiguration } from "./OpenAIConfiguration";
import { OpenAIContext } from "./OpenAIContext";
import { OpenAIModels } from "./OpenAIModels";
import { OpenAIValidator } from "./OpenAIValidator";
import { OpenAICapabilities } from "./OpenAICapabilities";

export class OpenAIProvider extends Provider {
  private readonly _transport: IProviderTransport;
  private readonly _models: typeof OpenAIModels = OpenAIModels;

  constructor(
    id: string,
    name: string,
    context: OpenAIContext,
    configuration: OpenAIConfiguration,
    metadata?: Record<string, any>,
    transport?: IProviderTransport
  ) {
    super(
      id,
      name,
      ProviderType.CHAT,
      OpenAICapabilities,
      context,
      configuration,
      metadata || {}
    );

    const apiKey = configuration.apiKey;
    const baseUrl = configuration.baseUrl || "https://api.openai.com/v1";

    this._transport = transport || new TransportBuilder()
      .withId(`${id}-transport`)
      .withBaseUrl(baseUrl)
      .withHeader("Authorization", `Bearer ${apiKey}`)
      .withHeader("Content-Type", "application/json")
      .withContext({ env: context.env || "dev", namespace: context.namespace || "default", logger: context.logger })
      .build();
  }

  public get models(): readonly ModelDescriptor[] {
    return this._models;
  }

  protected async performExecute(request: ProviderRequest): Promise<ProviderResponse> {
    OpenAIValidator.validateRequest(request);

    // Check if it is an embedding request
    const isEmbedding = request.model?.includes("embedding") || (!request.messages && request.prompt);
    if (isEmbedding) {
      const body = {
        model: request.model || "text-embedding-3-small",
        input: request.prompt || request.messages?.map((m: any) => m.content).join("\n") || "",
      };

      const response = await this._transport.execute({
        id: `req-${Date.now()}`,
        url: `${this._transport.baseUrl}/embeddings`,
        method: "POST",
        body,
      });

      return {
        responseId: `resp-${Date.now()}`,
        providerId: this.id,
        model: body.model,
        content: JSON.stringify(response.body.data?.[0]?.embedding || []),
        text: JSON.stringify(response.body.data?.[0]?.embedding || []),
        latency: response.latency,
        usage: response.body.usage ? {
          promptTokens: response.body.usage.prompt_tokens,
          completionTokens: 0,
          totalTokens: response.body.usage.total_tokens,
        } : undefined,
      };
    }

    const body = {
      model: request.model || "gpt-4o-mini",
      messages: request.messages || [{ role: "user", content: request.prompt || "" }],
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      stream: false,
    };

    const response = await this._transport.execute({
      id: `req-${Date.now()}`,
      url: `${this._transport.baseUrl}/chat/completions`,
      method: "POST",
      body,
    });

    const choice = response.body.choices?.[0];
    const text = choice?.message?.content || "";

    return {
      responseId: response.body.id || `resp-${Date.now()}`,
      providerId: this.id,
      model: body.model,
      content: text,
      text,
      latency: response.latency,
      usage: response.body.usage ? {
        promptTokens: response.body.usage.prompt_tokens,
        completionTokens: response.body.usage.completion_tokens,
        totalTokens: response.body.usage.total_tokens,
      } : undefined,
      finishReason: choice?.finish_reason || "stop",
    };
  }

  protected async *performStream(request: ProviderRequest): AsyncGenerator<ProviderResponseChunk> {
    OpenAIValidator.validateRequest(request);

    const body = {
      model: request.model || "gpt-4o-mini",
      messages: request.messages || [{ role: "user", content: request.prompt || "" }],
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      stream: true,
    };

    const streamGenerator = this._transport.stream({
      id: `stream-${Date.now()}`,
      url: `${this._transport.baseUrl}/chat/completions`,
      method: "POST",
      body,
    });

    for await (const chunk of streamGenerator) {
      const choice = chunk.body.choices?.[0];
      const content = choice?.delta?.content || "";
      yield {
        chunkId: chunk.body.id || `chunk-${Date.now()}`,
        content,
        finishReason: choice?.finish_reason || undefined,
        usage: chunk.body.usage ? {
          promptTokens: chunk.body.usage.prompt_tokens,
          completionTokens: chunk.body.usage.completion_tokens,
          totalTokens: chunk.body.usage.total_tokens,
        } : undefined,
      };
    }
  }
}
