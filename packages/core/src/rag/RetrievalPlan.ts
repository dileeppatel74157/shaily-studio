import { RetrievalStrategy } from "./RetrievalStrategy";
import { KnowledgeMetadata } from "../knowledge/KnowledgeMetadata";

export interface RetrievalPlan {
  readonly strategy: RetrievalStrategy;
  readonly query: string;
  readonly collection?: string;
  readonly metadata?: KnowledgeMetadata;
  readonly limits?: {
    readonly maxChunks?: number;
    readonly maxCharacters?: number;
  };
}
