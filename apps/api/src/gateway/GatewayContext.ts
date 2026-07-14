import {
  ILogger,
  IOrchestrator,
  ILLMRouter,
  IProviderRegistry,
  IAgentRegistry,
  IWorkflowEngine,
  IToolRegistry,
  IPromptRegistry,
  IKnowledgeBase,
  IRAGEngine,
  IPluginRegistry,
  IMCPServer,
} from "@shaily/core";

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
