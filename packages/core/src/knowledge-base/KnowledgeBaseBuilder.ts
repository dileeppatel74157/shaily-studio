import { IKnowledgeBaseEngine } from "./interfaces";
import { KnowledgeBaseEngine } from "./KnowledgeBaseEngine";
import { KnowledgeBaseConfiguration } from "./models";
import { EmbeddingProvider } from "./EmbeddingProvider";
import { KnowledgeBaseValidationException } from "./types";

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
