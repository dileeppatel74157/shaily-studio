import { IRAGEngine } from "./IRAGEngine";
import { RAGEngine } from "./RAGEngine";
import { RAGContext } from "./RAGContext";
import { ContextWindow } from "./ContextWindow";
import { IKnowledgeBase } from "../knowledge/IKnowledgeBase";
import { PromptRegistry } from "../prompts/PromptRegistry";
import { RAGValidationException } from "./types";

export class RAGBuilder {
  private _knowledgeBase?: IKnowledgeBase;
  private _promptRegistry?: PromptRegistry;
  private _contextWindow: ContextWindow = {};
  private _metadata: Record<string, any> = {};

  public withKnowledgeBase(kb: IKnowledgeBase): this {
    this._knowledgeBase = kb;
    return this;
  }

  public withPromptRegistry(registry: PromptRegistry): this {
    this._promptRegistry = registry;
    return this;
  }

  public withContextWindow(window: ContextWindow): this {
    this._contextWindow = window;
    return this;
  }

  public withStrategy(strategy: any): this {
    // Included to satisfy builder schema requirements
    return this;
  }

  public withMetadata(metadata: Record<string, any>): this {
    this._metadata = { ...this._metadata, ...metadata };
    return this;
  }

  public build(): IRAGEngine {
    if (!this._knowledgeBase) {
      throw new RAGValidationException("Knowledge Base is required.");
    }
    if (!this._promptRegistry) {
      throw new RAGValidationException("Prompt Registry is required.");
    }

    const context: RAGContext = {
      knowledgeBase: this._knowledgeBase,
      promptRegistry: this._promptRegistry,
      contextWindow: this._contextWindow,
      metadata: this._metadata,
    };

    return new RAGEngine(context);
  }
}
