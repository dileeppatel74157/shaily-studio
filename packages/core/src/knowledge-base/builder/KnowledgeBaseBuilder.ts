import { IKnowledgeBaseEngine } from "../interfaces/interfaces";
import { KnowledgeBaseEngine } from "../engine/KnowledgeBaseEngine";
import { KnowledgeBaseConfiguration } from "../models/models";
import { EmbeddingProvider } from "../types/EmbeddingProvider";
import { KnowledgeBaseValidationException } from "../types/types";

export class KnowledgeBaseBuilder {
  private _context?: any;
  private _config?: KnowledgeBaseConfiguration;

  public withContext(context: any): this {
    this._context = context;
    return this;
  }

  public withConfig(config: KnowledgeBaseConfiguration): this {
    this._config = config;
    return this;
  }

  public build(): IKnowledgeBaseEngine {
    if (!this._context) {
      throw new KnowledgeBaseValidationException("Context is required to build KnowledgeBaseEngine.");
    }
    const config: KnowledgeBaseConfiguration = this._config ?? {
      embeddingProvider: EmbeddingProvider.MOCK,
      embeddingDimensions: 128,
      defaultTopK: 10,
      persistenceEnabled: false,
    };
    return new KnowledgeBaseEngine(this._context, config);
  }
}
