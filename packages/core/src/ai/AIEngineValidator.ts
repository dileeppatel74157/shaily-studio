import { AIRequest } from "./AIRequest";
import { AIExecutionOptions } from "./AIExecutionOptions";
import { AITaskType } from "./AITaskType";
import { AIEngineValidationException } from "./types";
import { AIEngineContext } from "./AIEngineContext";

export class AIEngineValidator {
  public static validateContext(context: AIEngineContext): void {
    if (!context) {
      throw new AIEngineValidationException("AIEngineContext cannot be null or undefined.");
    }
    if (!context.router) {
      throw new AIEngineValidationException("AIEngineContext must provide a valid router (ILLMRouter).");
    }
  }

  public static validateRequest(request: AIRequest): void {
    if (!request) {
      throw new AIEngineValidationException("AIRequest cannot be null or undefined.");
    }
    if (!request.taskType) {
      throw new AIEngineValidationException("AIRequest must specify a taskType.");
    }
    if (!Object.values(AITaskType).includes(request.taskType)) {
      throw new AIEngineValidationException(`Invalid task type: "${request.taskType}".`);
    }

    const hasPrompt = !!request.prompt?.trim();
    const hasMessages = Array.isArray(request.messages) && request.messages.length > 0;
    const hasConversation = !!request.conversation?.messages && request.conversation.messages.length > 0;
    const hasConversationId = !!request.conversationId?.trim();

    if (request.taskType === AITaskType.EMBEDDINGS) {
      if (!hasPrompt && !hasMessages && !hasConversation && !hasConversationId) {
        throw new AIEngineValidationException("Embeddings request must provide a prompt, messages, or conversationId.");
      }
    } else {
      if (!hasPrompt && !hasMessages && !hasConversation && !hasConversationId) {
        throw new AIEngineValidationException("AIRequest prompt, messages, or conversationId cannot be empty.");
      }
    }

    if (request.taskType === AITaskType.STRUCTURED_OUTPUT && !request.responseSchema) {
      throw new AIEngineValidationException("Structured output task requires a responseSchema.");
    }
  }

  public static validateExecutionOptions(options?: AIExecutionOptions): void {
    if (!options) return;
    if (options.timeout !== undefined && (options.timeout <= 0 || isNaN(options.timeout))) {
      throw new AIEngineValidationException("Execution option 'timeout' must be a positive number.");
    }
    if (options.retries !== undefined && (options.retries < 0 || isNaN(options.retries))) {
      throw new AIEngineValidationException("Execution option 'retries' must be a non-negative integer.");
    }
  }
}
