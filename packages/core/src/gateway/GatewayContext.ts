import { ILogger } from "../logger/ILogger";
import { IOrchestrator } from "../orchestrator/IOrchestrator";
import { ILLMRouter } from "../router/ILLMRouter";
import { IProviderRegistry } from "../providers/IProviderRegistry";
import { IAgentRegistry } from "../agents/IAgentRegistry";
import { IWorkflowEngine } from "../workflow/IWorkflowEngine";
import { IToolRegistry } from "../tools/IToolRegistry";
import { IPromptRegistry } from "../prompts/IPromptRegistry";
import { IKnowledgeBase } from "../knowledge/IKnowledgeBase";
import { IRAGEngine } from "../rag/IRAGEngine";
import { IPluginRegistry } from "../plugins/IPluginRegistry";
import { IMCPServer } from "../mcp/IMCPServer";

export interface GatewayContext {
  readonly logger: ILogger;
  readonly orchestrator: IOrchestrator;
  readonly router: ILLMRouter;
  readonly providers: IProviderRegistry;
  readonly agents: IAgentRegistry;
  readonly workflow: IWorkflowEngine;
  readonly tools: IToolRegistry;
  readonly prompts: IPromptRegistry;
  readonly knowledge: IKnowledgeBase;
  readonly rag: IRAGEngine;
  readonly plugins: IPluginRegistry;
  readonly mcp: IMCPServer;
  readonly metadata: Readonly<Record<string, any>>;
}
