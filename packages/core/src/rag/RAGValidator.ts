import { RAGRequest } from "./RAGRequest";
import { RAGContext } from "./RAGContext";
import { RetrievalStrategy } from "./RetrievalStrategy";
import { RAGValidationException } from "./types";

export class RAGValidator {
  public validateContext(context: RAGContext): void {
    if (!context.knowledgeBase) {
      throw new RAGValidationException("Knowledge base is required.");
    }
    if (!context.promptRegistry) {
      throw new RAGValidationException("Prompt registry is required.");
    }
  }

  public validateRequest(request: RAGRequest, context: RAGContext): void {
    if (!request.query || request.query.trim() === "") {
      throw new RAGValidationException("RAG query cannot be empty.");
    }

    if (!Object.values(RetrievalStrategy).includes(request.strategy)) {
      throw new RAGValidationException(
        `Unsupported retrieval strategy: "${request.strategy}".`
      );
    }

    if (request.maxChunks !== undefined && request.maxChunks < 0) {
      throw new RAGValidationException("maxChunks limit cannot be negative.");
    }

    if (request.maxCharacters !== undefined && request.maxCharacters < 0) {
      throw new RAGValidationException("maxCharacters limit cannot be negative.");
    }

    if (request.promptId !== undefined) {
      if (!context.promptRegistry.has(request.promptId)) {
        throw new RAGValidationException(
          `Prompt with ID "${request.promptId}" not found in prompt registry.`
        );
      }
    }
  }
}
