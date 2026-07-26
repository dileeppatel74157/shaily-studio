import { KnowledgeMetadata } from "./KnowledgeMetadata";

export interface KnowledgeSnapshot {
  readonly id: string;
  readonly name: string;
  readonly collectionsCount: number;
  readonly documentsCount: number;
  readonly chunksCount: number;
  readonly timestamp: Date;
  readonly metadata: KnowledgeMetadata;
}
