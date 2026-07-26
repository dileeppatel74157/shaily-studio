import { KnowledgeChunk } from "./KnowledgeChunk";
import { KnowledgeMetadata } from "./KnowledgeMetadata";

export interface KnowledgeDocument {
  readonly id: string;
  readonly title: string;
  readonly collection: string;
  readonly metadata: KnowledgeMetadata;
  readonly chunks: readonly KnowledgeChunk[];
}
