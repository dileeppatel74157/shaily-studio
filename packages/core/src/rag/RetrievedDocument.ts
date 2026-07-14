import { KnowledgeMetadata } from "../knowledge/KnowledgeMetadata";

export interface RetrievedDocument {
  readonly documentId: string;
  readonly chunkId: string;
  readonly text: string;
  readonly score: number;
  readonly metadata: KnowledgeMetadata;
}
