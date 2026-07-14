import { KnowledgeMetadata } from "./KnowledgeMetadata";

export interface KnowledgeResult {
  readonly documentId: string;
  readonly chunkId: string;
  readonly text: string;
  readonly score: number;
  readonly metadata: KnowledgeMetadata;
}
