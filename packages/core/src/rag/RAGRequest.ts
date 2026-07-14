import { RetrievalStrategy } from "./RetrievalStrategy";
import { KnowledgeMetadata } from "../knowledge/KnowledgeMetadata";

export interface RAGRequest {
  readonly query: string;
  readonly strategy: RetrievalStrategy;
  readonly promptId?: string;
  readonly promptVariables?: Readonly<Record<string, unknown>>;
  readonly collection?: string;
  readonly metadata?: KnowledgeMetadata;
  readonly maxChunks?: number;
  readonly maxCharacters?: number;
}
