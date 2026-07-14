import { IRAGEngine } from "./IRAGEngine";
import { RAGContext } from "./RAGContext";
import { RAGRequest } from "./RAGRequest";
import { RAGResponse } from "./RAGResponse";
import { RetrievedDocument } from "./RetrievedDocument";
import { RetrievalStrategy } from "./RetrievalStrategy";
import { RAGSnapshot } from "./RAGSnapshot";
import { RAGValidator } from "./RAGValidator";
import { ContextAssembler } from "./ContextAssembler";
import { deepFreeze } from "./types";

export class RAGEngine implements IRAGEngine {
  private readonly _validator = new RAGValidator();

  constructor(public readonly context: RAGContext) {
    this._validator.validateContext(context);
    deepFreeze(this.context);
  }

  public async retrieve(request: RAGRequest): Promise<RAGResponse> {
    this._validator.validateRequest(request, this.context);

    const startTime = Date.now();

    let documents: RetrievedDocument[] = [];

    if (request.strategy === RetrievalStrategy.EXACT_MATCH) {
      documents = this.context.knowledgeBase.search({
        keyword: request.query,
        exact: true,
        collection: request.collection,
        metadata: request.metadata,
      });
    } else if (request.strategy === RetrievalStrategy.KEYWORD) {
      documents = this.context.knowledgeBase.search({
        keyword: request.query,
        exact: false,
        collection: request.collection,
        metadata: request.metadata,
      });
    } else if (request.strategy === RetrievalStrategy.HYBRID) {
      const exactDocs = this.context.knowledgeBase.search({
        keyword: request.query,
        exact: true,
        collection: request.collection,
        metadata: request.metadata,
      });

      const keywordDocs = this.context.knowledgeBase.search({
        keyword: request.query,
        exact: false,
        collection: request.collection,
        metadata: request.metadata,
      });

      // Merge results by chunkId
      const mergedMap = new Map<string, RetrievedDocument>();
      for (const d of exactDocs) {
        mergedMap.set(d.chunkId, d);
      }
      for (const d of keywordDocs) {
        const existing = mergedMap.get(d.chunkId);
        if (existing) {
          mergedMap.set(d.chunkId, {
            ...existing,
            score: existing.score + d.score,
          });
        } else {
          mergedMap.set(d.chunkId, d);
        }
      }

      documents = Array.from(mergedMap.values());
      documents.sort((a, b) => b.score - a.score);
    }

    // Assemble context using limits
    const maxChunks =
      request.maxChunks !== undefined
        ? request.maxChunks
        : this.context.contextWindow.maxChunks;
    const maxCharacters =
      request.maxCharacters !== undefined
        ? request.maxCharacters
        : this.context.contextWindow.maxCharacters;

    const assembler = new ContextAssembler();
    const assembledContext = assembler.assemble(
      documents,
      maxChunks,
      maxCharacters
    );

    // Render prompt if promptId is supplied
    let promptText: string | undefined;
    if (request.promptId !== undefined) {
      const prompt = this.context.promptRegistry.get(request.promptId);
      if (prompt) {
        const vars = {
          ...request.promptVariables,
          context: assembledContext,
        };
        promptText = prompt.render(vars);
      }
    }

    const response: RAGResponse = {
      context: assembledContext,
      documents,
      strategyUsed: request.strategy,
      executionTime: Date.now() - startTime,
      promptText,
    };

    return deepFreeze(response);
  }

  public snapshot(): RAGSnapshot {
    return deepFreeze({
      knowledgeBaseId: this.context.knowledgeBase.id,
      promptsCount: this.context.promptRegistry.snapshot().promptsCount,
      contextWindow: this.context.contextWindow,
      timestamp: new Date(),
      metadata: this.context.metadata,
    });
  }
}
