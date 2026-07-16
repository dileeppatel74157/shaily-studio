import {
  Provider,
  ProviderRequest,
  ProviderResponse,
  ProviderResponseChunk,
  ProviderType,
  ProviderFeature,
  IProviderTransport,
  TransportBuilder,
  ModelDescriptor,
} from "@shaily/core";
import { NvidiaConfiguration } from "./NvidiaConfiguration";
import { NvidiaContext } from "./NvidiaContext";
import { NvidiaModels } from "./NvidiaModels";
import { NvidiaValidator } from "./NvidiaValidator";
import { NvidiaCapabilities } from "./NvidiaCapabilities";

export class NvidiaProvider extends Provider {
  private readonly _transport: IProviderTransport;
  private readonly _models: typeof NvidiaModels = NvidiaModels;

  constructor(
    id: string,
    name: string,
    context: NvidiaContext,
    configuration: NvidiaConfiguration,
    metadata?: Record<string, any>,
    transport?: IProviderTransport
  ) {
    super(
      id,
      name,
      ProviderType.CHAT,
      NvidiaCapabilities,
      context,
      configuration,
      metadata || {}
    );

    const apiKey = configuration.apiKey;
    const baseUrl = configuration.baseUrl || "https://integrate.api.nvidia.com/v1";

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
    NvidiaValidator.validateRequest(request);

    const body = {
      model: request.model || "nvidia/llama-3.1-70b-instruct",
      messages: request.messages,
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
    NvidiaValidator.validateRequest(request);

    const body = {
      model: request.model || "nvidia/llama-3.1-70b-instruct",
      messages: request.messages,
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
