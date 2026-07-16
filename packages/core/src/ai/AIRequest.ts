import { AITaskType } from "./AITaskType";
import { AIConversation } from "./AIConversation";
import { AIMessage } from "./AIMessage";

export interface AIRequest {
  readonly requestId?: string;
  readonly taskType: AITaskType;
  readonly prompt?: string;
  readonly messages?: readonly AIMessage[];
  readonly conversation?: AIConversation;
  readonly conversationId?: string;
  readonly modelId?: string;
  readonly providerId?: string;
  readonly systemPrompt?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly responseSchema?: Readonly<Record<string, unknown>>; // Structured Outputs
  readonly tools?: readonly any[]; // Tool Calling
  readonly toolChoice?: string | object;
  readonly attachments?: readonly {
    readonly type: string;
    readonly data: string; // Base64
  }[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}
