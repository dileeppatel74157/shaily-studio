import { KnowledgeMetadata } from "./KnowledgeMetadata";

export interface KnowledgeCollection {
  readonly name: string;
  readonly description: string;
  readonly metadata: KnowledgeMetadata;
}
