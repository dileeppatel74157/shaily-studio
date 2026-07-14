import { IToolRegistry } from "../tools/IToolRegistry";
import { IPromptRegistry } from "../prompts/IPromptRegistry";
import { IKnowledgeBase } from "../knowledge/IKnowledgeBase";
import { IPluginRegistry } from "../plugins/IPluginRegistry";

export interface MCPContext {
  readonly tools: IToolRegistry;
  readonly prompts: IPromptRegistry;
  readonly knowledge: IKnowledgeBase;
  readonly plugins: IPluginRegistry;
  readonly metadata: Readonly<Record<string, any>>;
}
