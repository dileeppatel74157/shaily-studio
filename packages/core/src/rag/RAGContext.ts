import { IKnowledgeBase } from "../knowledge/IKnowledgeBase";
import { PromptRegistry } from "../prompts/PromptRegistry";
import { ContextWindow } from "./ContextWindow";

export interface RAGContext {
  readonly knowledgeBase: IKnowledgeBase;
  readonly promptRegistry: PromptRegistry;
  readonly contextWindow: ContextWindow;
  readonly metadata: Readonly<Record<string, any>>;
}
