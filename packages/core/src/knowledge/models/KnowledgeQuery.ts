import { KnowledgeMetadata } from "./KnowledgeMetadata";

export interface KnowledgeQuery {
  readonly keyword?: string;
  readonly exact?: boolean;
  readonly collection?: string;
  readonly metadata?: KnowledgeMetadata;
}
