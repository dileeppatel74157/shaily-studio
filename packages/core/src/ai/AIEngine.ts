import { IAIEngine } from "./IAIEngine";
import { AIRequest } from "./AIRequest";
import { AIResponse } from "./AIResponse";
import { AIStreamChunk } from "./AIStreamChunk";
import { AIEngineSnapshot } from "./AIEngineSnapshot";
import { AIExecutionOptions } from "./AIExecutionOptions";
import { AIEngineContext } from "./AIEngineContext";
import { AIEngineState } from "./AIEngineState";
import { AIEngineValidator } from "./AIEngineValidator";
import { AITaskType } from "./AITaskType";
import { MetricType } from "../observability/MetricType";
import {
  InvalidAIEngineStateException,
  deepFreeze,
} from "./types";

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class AIEngine implements IAIEngine {
  private _state: AIEngineState = AIEngineState.CREATED;
  private _initializedAt?: Date;
  private _startedAt?: Date;
  private _stoppedAt?: Date;
  private _requestCount = 0;
  private _failureCount = 0;
  private _totalTokenCount = 0;

  constructor(
    private readonly _context: AIEngineContext,
    private readonly _metadata: Record<string, unknown> = {}
  ) {
    AIEngineValidator.validateContext(_context);
  }

  public get state(): AIEngineState {
    return this._state;
  }

  public async initialize(): Promise<void> {
    if (this._state !== AIEngineState.CREATED) {
      throw new InvalidAIEngineStateException("initialize", this._state);
    }
    this._state = AIEngineState.INITIALIZING;
    try {
      this._initializedAt = new Date();
      this._state = AIEngineState.READY;
    } catch (err) {
      this._state = AIEngineState.FAILED;
      throw err;
    }
  }

  public async start(): Promise<void> {
    if (this._state !== AIEngineState.READY) {
      throw new InvalidAIEngineStateException("start", this._state);
    }
    try {
      this._startedAt = new Date();
      this._state = AIEngineState.RUNNING;
    } catch (err) {
      this._state = AIEngineState.FAILED;
      throw err;
    }
  }

  public async stop(): Promise<void> {
    if (this._state !== AIEngineState.RUNNING) {
      throw new InvalidAIEngineStateException("stop", this._state);
    }
    try {
      this._stoppedAt = new Date();
      this._state = AIEngineState.STOPPED;
    } catch (err) {
      this._state = AIEngineState.FAILED;
      throw err;
    }
  }

  public async execute(
    request: AIRequest,
    options?: AIExecutionOptions
  ): Promise<AIResponse> {
    if (this._state !== AIEngineState.RUNNING && this._state !== AIEngineState.READY) {
      throw new InvalidAIEngineStateException("execute", this._state);
    }

    AIEngineValidator.validateRequest(request);
    AIEngineValidator.validateExecutionOptions(options);

    this._requestCount++;
    const startTime = Date.now();
    const correlationId = options?.correlationId || "corr-" + generateUUID();

    // 1. Security Authorization & Auditing
    if (this._context.security && !options?.bypassSecurity) {
      this._context.security.audit(
        "ai.execute",
        undefined,
        "SUCCESS",
        { taskType: request.taskType, correlationId }
      );
    }

    // 2. Observability Span
    const span = this._context.observability?.startSpan(
      "AIEngine.execute",
      undefined,
      correlationId,
      { taskType: request.taskType }
    );

    // 3. MessageBus Event: started
    if (this._context.messageBus) {
      await this._context.messageBus.publish(
        {
          id: generateUUID(),
          type: "ai.execution.started",
          payload: {
            requestId: request.requestId || "req-" + generateUUID(),
            taskType: request.taskType,
            correlationId,
          },
        },
        { correlationId }
      );
    }

    try {
      const messages: any[] = [];
      if (request.systemPrompt) {
        messages.push({ role: "system", content: request.systemPrompt });
      }
      if (request.conversationId) {
        if (!this._context.conversationManager) {
          throw new Error("ConversationManager is not configured on AIEngineContext.");
        }
        const hist = this._context.conversationManager.history(request.conversationId);
        const mapped = hist.messages.map((m) => {
          let role: "system" | "user" | "assistant" | "tool" = "user";
          if (m.role === "SYSTEM" || m.role === "DEVELOPER") role = "system";
          else if (m.role === "USER") role = "user";
          else if (m.role === "ASSISTANT") role = "assistant";
          else if (m.role === "TOOL") role = "tool";
          return {
            role,
            content: m.content,
            name: m.metadata?.name as string | undefined,
          };
        });
        messages.push(...mapped);
      } else if (request.messages) {
        messages.push(...request.messages);
      } else if (request.conversation?.messages) {
        messages.push(...request.conversation.messages);
      } else if (request.prompt) {
        messages.push({ role: "user", content: request.prompt });
      }

      const routerMetadata: Record<string, any> = {
        ...request.metadata,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        responseSchema: request.responseSchema,
        tools: request.tools,
        toolChoice: request.toolChoice,
      };

      const requiredCapabilities: any = {};
      if (request.taskType === AITaskType.VISION || request.attachments?.length) {
        requiredCapabilities.vision = true;
        routerMetadata.vision = true;
      }
      if (request.taskType === AITaskType.EMBEDDINGS) {
        requiredCapabilities.embeddings = true;
        routerMetadata.embeddings = true;
      }
      if (request.taskType === AITaskType.JSON_MODE) {
        requiredCapabilities.jsonMode = true;
        routerMetadata.JSON = true;
      }
      if (request.taskType === AITaskType.TOOL_CALLING || request.tools) {
        requiredCapabilities.toolCalling = true;
        routerMetadata.tools = true;
      }
      if (request.taskType === AITaskType.STRUCTURED_OUTPUT) {
        requiredCapabilities.jsonMode = true;
        routerMetadata.JSON = true;
      }

      const routerRequest = {
        prompt: request.prompt,
        messages,
        attachments: request.attachments,
        preferredProvider: request.providerId,
        preferredModel: request.modelId,
        requiredCapabilities,
        routingStrategy: options?.routingStrategy,
        taskType: request.taskType,
        streamRequirement: false,
        metadata: routerMetadata,
      };

      const routerResponse = await this._context.router.route(routerRequest);
      const executionDurationMs = Date.now() - startTime;
      const providerResponse = routerResponse.providerResponse;

      const inputTokens = providerResponse.usage?.promptTokens || 0;
      const outputTokens = providerResponse.usage?.completionTokens || 0;
      const totalTokens = providerResponse.usage?.totalTokens || (inputTokens + outputTokens);

      this._totalTokenCount += totalTokens;

      const usage = {
        provider: routerResponse.providerId,
        model: routerResponse.modelId,
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedLatencyMs: providerResponse.latency,
        executionDurationMs,
        finishReason: providerResponse.finishReason,
      };

      // Handle structured output validation or checking
      if (request.taskType === AITaskType.STRUCTURED_OUTPUT && request.responseSchema) {
        // Just verify it's valid JSON
        JSON.parse(providerResponse.content || "{}");
      }

      const result = {
        responseId: providerResponse.responseId || "resp-" + generateUUID(),
        content: providerResponse.content || "",
        usage,
        toolCalls: providerResponse.toolCalls?.map((tc: any) => ({
          id: tc.id || "call-" + generateUUID(),
          name: tc.name,
          arguments: typeof tc.arguments === "string" ? tc.arguments : JSON.stringify(tc.arguments || {}),
        })),
        rawResponse: providerResponse,
      };

      const response: AIResponse = {
        responseId: result.responseId,
        success: true,
        results: [result],
        timestamp: new Date(),
      };

      // 4. Record Success Metrics
      if (this._context.observability) {
        this._context.observability.recordMetric({
          name: "ai_engine.requests",
          type: MetricType.COUNTER,
          value: 1,
          timestamp: new Date(),
          tags: { status: "success", taskType: request.taskType },
        });
        this._context.observability.recordMetric({
          name: "ai_engine.duration",
          type: MetricType.HISTOGRAM,
          value: executionDurationMs,
          timestamp: new Date(),
          tags: { taskType: request.taskType },
        });
        if (totalTokens > 0) {
          this._context.observability.recordMetric({
            name: "ai_engine.tokens",
            type: MetricType.COUNTER,
            value: totalTokens,
            timestamp: new Date(),
            tags: { taskType: request.taskType },
          });
        }
      }

      // 5. MessageBus Event: completed
      if (this._context.messageBus) {
        await this._context.messageBus.publish(
          {
            id: generateUUID(),
            type: "ai.execution.completed",
            payload: {
              requestId: request.requestId || "req-" + generateUUID(),
              usage,
              correlationId,
            },
          },
          { correlationId }
        );
      }

      // 6. End Observability Span
      if (span) {
        this._context.observability?.endSpan(span.id);
      }

      return deepFreeze(response);
    } catch (err: any) {
      this._failureCount++;
      const executionDurationMs = Date.now() - startTime;

      // Record Failure Metrics
      if (this._context.observability) {
        this._context.observability.recordMetric({
          name: "ai_engine.requests",
          type: MetricType.COUNTER,
          value: 1,
          timestamp: new Date(),
          tags: { status: "failure", taskType: request.taskType },
        });
        this._context.observability.recordMetric({
          name: "ai_engine.failures",
          type: MetricType.COUNTER,
          value: 1,
          timestamp: new Date(),
          tags: { error: err.message, taskType: request.taskType },
        });
      }

      // MessageBus Event: failed
      if (this._context.messageBus) {
        await this._context.messageBus.publish(
          {
            id: generateUUID(),
            type: "ai.execution.failed",
            payload: {
              requestId: request.requestId || "req-" + generateUUID(),
              error: err.message,
              correlationId,
            },
          },
          { correlationId }
        );
      }

      // End Observability Span
      if (span) {
        this._context.observability?.endSpan(span.id);
      }

      throw err;
    }
  }

  public async *stream(
    request: AIRequest,
    options?: AIExecutionOptions
  ): AsyncGenerator<AIStreamChunk> {
    if (this._state !== AIEngineState.RUNNING && this._state !== AIEngineState.READY) {
      throw new InvalidAIEngineStateException("stream", this._state);
    }

    AIEngineValidator.validateRequest(request);
    AIEngineValidator.validateExecutionOptions(options);

    this._requestCount++;
    const startTime = Date.now();
    const correlationId = options?.correlationId || "corr-" + generateUUID();

    // Security Check
    if (this._context.security && !options?.bypassSecurity) {
      this._context.security.audit(
        "ai.stream",
        undefined,
        "SUCCESS",
        { taskType: request.taskType, correlationId }
      );
    }

    // Span start
    const span = this._context.observability?.startSpan(
      "AIEngine.stream",
      undefined,
      correlationId,
      { taskType: request.taskType }
    );

    // MessageBus Event: started
    if (this._context.messageBus) {
      await this._context.messageBus.publish(
        {
          id: generateUUID(),
          type: "ai.execution.started",
          payload: {
            requestId: request.requestId || "req-" + generateUUID(),
            taskType: request.taskType,
            correlationId,
          },
        },
        { correlationId }
      );
    }

    try {
      const messages: any[] = [];
      if (request.systemPrompt) {
        messages.push({ role: "system", content: request.systemPrompt });
      }
      if (request.conversationId) {
        if (!this._context.conversationManager) {
          throw new Error("ConversationManager is not configured on AIEngineContext.");
        }
        const hist = this._context.conversationManager.history(request.conversationId);
        const mapped = hist.messages.map((m) => {
          let role: "system" | "user" | "assistant" | "tool" = "user";
          if (m.role === "SYSTEM" || m.role === "DEVELOPER") role = "system";
          else if (m.role === "USER") role = "user";
          else if (m.role === "ASSISTANT") role = "assistant";
          else if (m.role === "TOOL") role = "tool";
          return {
            role,
            content: m.content,
            name: m.metadata?.name as string | undefined,
          };
        });
        messages.push(...mapped);
      } else if (request.messages) {
        messages.push(...request.messages);
      } else if (request.conversation?.messages) {
        messages.push(...request.conversation.messages);
      } else if (request.prompt) {
        messages.push({ role: "user", content: request.prompt });
      }

      const routerMetadata: Record<string, any> = {
        ...request.metadata,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        responseSchema: request.responseSchema,
        tools: request.tools,
        toolChoice: request.toolChoice,
      };

      const requiredCapabilities: any = {};
      if (request.taskType === AITaskType.VISION || request.attachments?.length) {
        requiredCapabilities.vision = true;
        routerMetadata.vision = true;
      }
      if (request.taskType === AITaskType.EMBEDDINGS) {
        requiredCapabilities.embeddings = true;
        routerMetadata.embeddings = true;
      }
      if (request.taskType === AITaskType.JSON_MODE) {
        requiredCapabilities.jsonMode = true;
        routerMetadata.JSON = true;
      }
      if (request.taskType === AITaskType.TOOL_CALLING || request.tools) {
        requiredCapabilities.toolCalling = true;
        routerMetadata.tools = true;
      }
      if (request.taskType === AITaskType.STRUCTURED_OUTPUT) {
        requiredCapabilities.jsonMode = true;
        routerMetadata.JSON = true;
      }

      const routerRequest = {
        prompt: request.prompt,
        messages,
        attachments: request.attachments,
        preferredProvider: request.providerId,
        preferredModel: request.modelId,
        requiredCapabilities,
        routingStrategy: options?.routingStrategy,
        taskType: request.taskType,
        streamRequirement: true,
        metadata: routerMetadata,
      };

      const streamGen = this._context.router.routeStream(routerRequest);

      let chunkCount = 0;
      let accumulatedText = "";
      let finalUsage: any = undefined;

      // Find candidates for usage stats model/provider
      const routerAny = this._context.router as any;
      const models = [
        ...(routerAny._modelRegistry?.list?.() || []),
        ...(routerAny.context?.providerRegistry?.list?.() || []).flatMap((p: any) => p.models || []),
      ];
      const selectedModel = models.find(m => m.id === request.modelId) || models[0];
      const selectedModelId = selectedModel?.id || "default-model";
      const selectedProviderId = selectedModel?.providerId || "default-provider";

      for await (const chunk of streamGen) {
        chunkCount++;
        accumulatedText += chunk.content;

        if (chunk.usage) {
          finalUsage = {
            provider: selectedProviderId,
            model: selectedModelId,
            inputTokens: chunk.usage.promptTokens || 0,
            outputTokens: chunk.usage.completionTokens || 0,
            totalTokens: chunk.usage.totalTokens || 0,
            estimatedLatencyMs: 0,
            executionDurationMs: Date.now() - startTime,
            finishReason: chunk.finishReason || undefined,
          };
          this._totalTokenCount += chunk.usage.totalTokens || 0;
        }

        const streamChunk: AIStreamChunk = {
          chunkId: chunk.chunkId || "chunk-" + generateUUID(),
          content: chunk.content || "",
          finishReason: chunk.finishReason || undefined,
          usage: finalUsage,
        };

        yield deepFreeze(streamChunk);
      }

      const executionDurationMs = Date.now() - startTime;

      if (!finalUsage) {
        // Synthesize a basic usage report if the final chunk didn't provide one
        finalUsage = {
          provider: selectedProviderId,
          model: selectedModelId,
          inputTokens: 0,
          outputTokens: chunkCount,
          totalTokens: chunkCount,
          estimatedLatencyMs: 0,
          executionDurationMs,
          finishReason: "stop",
        };
      }

      // Record Metrics
      if (this._context.observability) {
        this._context.observability.recordMetric({
          name: "ai_engine.requests",
          type: MetricType.COUNTER,
          value: 1,
          timestamp: new Date(),
          tags: { status: "success", taskType: request.taskType },
        });
        this._context.observability.recordMetric({
          name: "ai_engine.duration",
          type: MetricType.HISTOGRAM,
          value: executionDurationMs,
          timestamp: new Date(),
          tags: { taskType: request.taskType },
        });
      }

      // MessageBus Event: completed
      if (this._context.messageBus) {
        await this._context.messageBus.publish(
          {
            id: generateUUID(),
            type: "ai.execution.completed",
            payload: {
              requestId: request.requestId || "req-" + generateUUID(),
              usage: finalUsage,
              correlationId,
            },
          },
          { correlationId }
        );
      }

      // End Span
      if (span) {
        this._context.observability?.endSpan(span.id);
      }

    } catch (err: any) {
      this._failureCount++;
      const executionDurationMs = Date.now() - startTime;

      // Record Failure Metrics
      if (this._context.observability) {
        this._context.observability.recordMetric({
          name: "ai_engine.requests",
          type: MetricType.COUNTER,
          value: 1,
          timestamp: new Date(),
          tags: { status: "failure", taskType: request.taskType },
        });
        this._context.observability.recordMetric({
          name: "ai_engine.failures",
          type: MetricType.COUNTER,
          value: 1,
          timestamp: new Date(),
          tags: { error: err.message, taskType: request.taskType },
        });
      }

      // MessageBus Event: failed
      if (this._context.messageBus) {
        await this._context.messageBus.publish(
          {
            id: generateUUID(),
            type: "ai.execution.failed",
            payload: {
              requestId: request.requestId || "req-" + generateUUID(),
              error: err.message,
              correlationId,
            },
          },
          { correlationId }
        );
      }

      // End Span
      if (span) {
        this._context.observability?.endSpan(span.id);
      }

      throw err;
    }
  }

  public snapshot(): AIEngineSnapshot {
    const snap: AIEngineSnapshot = {
      id: "ai-engine",
      state: this._state,
      initializedAt: this._initializedAt,
      startedAt: this._startedAt,
      stoppedAt: this._stoppedAt,
      requestCount: this._requestCount,
      failureCount: this._failureCount,
      totalTokenCount: this._totalTokenCount,
      metadata: { ...this._metadata },
      timestamp: new Date(),
    };
    return deepFreeze(snap);
  }
}
