import { KnowledgeDocument } from "./KnowledgeDocument";
import { KnowledgeQuery } from "./KnowledgeQuery";
import { KnowledgeResult } from "./KnowledgeResult";
import { KnowledgeSnapshot } from "./KnowledgeSnapshot";

export interface IKnowledgeBase {
  readonly id: string;
  readonly name: string;
  readonly metadata: Readonly<Record<string, any>>;

  addDocument(document: KnowledgeDocument): void;
  removeDocument(documentId: string): boolean;
  getDocument(documentId: string): KnowledgeDocument | undefined;
  hasDocument(documentId: string): boolean;
  search(query: KnowledgeQuery): KnowledgeResult[];
  snapshot(): KnowledgeSnapshot;
}
