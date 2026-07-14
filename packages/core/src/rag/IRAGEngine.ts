import { RAGRequest } from "./RAGRequest";
import { RAGResponse } from "./RAGResponse";
import { RAGSnapshot } from "./RAGSnapshot";
import { RAGContext } from "./RAGContext";

export interface IRAGEngine {
  readonly context: RAGContext;

  retrieve(request: RAGRequest): Promise<RAGResponse>;
  snapshot(): RAGSnapshot;
}
