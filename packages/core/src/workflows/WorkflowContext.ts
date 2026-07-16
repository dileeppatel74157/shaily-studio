import { ILogger } from "../logger/ILogger";
import { IAIEngine } from "../ai/IAIEngine";
import { IToolRegistry } from "../tools/IToolRegistry";
import { IAgentRegistry } from "../agents/IAgentRegistry";
import { IRAGEngine } from "../rag/IRAGEngine";
import { IConversationManager } from "../conversation/IConversationManager";

export interface WorkflowContext {
  readonly logger: ILogger;
  readonly config?: any;
  readonly eventBus?: any;
  readonly memory?: any;
  readonly registry?: any;
  readonly aiEngine: IAIEngine;
  readonly toolRegistry: IToolRegistry;
  readonly agentRegistry: IAgentRegistry;
  readonly ragEngine?: IRAGEngine;
  readonly conversationManager?: IConversationManager;
}
