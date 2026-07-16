import { AIRequest } from "./AIRequest";
import { AIResponse } from "./AIResponse";
import { AIStreamChunk } from "./AIStreamChunk";
import { AIEngineSnapshot } from "./AIEngineSnapshot";
import { AIExecutionOptions } from "./AIExecutionOptions";

export interface IAIEngine {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;

  execute(
    request: AIRequest,
    options?: AIExecutionOptions
  ): Promise<AIResponse>;

  stream(
    request: AIRequest,
    options?: AIExecutionOptions
  ): AsyncGenerator<AIStreamChunk>;

  snapshot(): AIEngineSnapshot;
}
