import { IKnowledgeBase } from "./IKnowledgeBase";
import { KnowledgeDocument } from "./KnowledgeDocument";
import { KnowledgeQuery } from "./KnowledgeQuery";
import { KnowledgeResult } from "./KnowledgeResult";
import { KnowledgeSnapshot } from "./KnowledgeSnapshot";
import { KnowledgeIndexer } from "./KnowledgeIndexer";
import { KnowledgeSearch } from "./KnowledgeSearch";
import { KnowledgeValidationException, deepFreeze } from "./types";

export class KnowledgeBase implements IKnowledgeBase {
  private readonly _documents = new Map<string, KnowledgeDocument>();
  private readonly _indexer = new KnowledgeIndexer();
  private readonly _searcher = new KnowledgeSearch();

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly metadata: Readonly<Record<string, any>>
  ) {
    deepFreeze(this.metadata);
  }

  public addDocument(document: KnowledgeDocument): void {
    if (this._documents.has(document.id)) {
      throw new KnowledgeValidationException(
        `Document with ID "${document.id}" is already registered.`
      );
    }

    // Perform validation and index
    this._indexer.index(document);

    // Deep freeze and store
    const frozenDoc = deepFreeze<KnowledgeDocument>(
      JSON.parse(JSON.stringify(document))
    );
    this._documents.set(document.id, frozenDoc);
  }

  public removeDocument(documentId: string): boolean {
    return this._documents.delete(documentId);
  }

  public getDocument(documentId: string): KnowledgeDocument | undefined {
    return this._documents.get(documentId);
  }

  public hasDocument(documentId: string): boolean {
    return this._documents.has(documentId);
  }

  public search(query: KnowledgeQuery): KnowledgeResult[] {
    const docList = Array.from(this._documents.values());
    return this._searcher.search(docList, query);
  }

  public snapshot(): KnowledgeSnapshot {
    const docs = Array.from(this._documents.values());
    const collections = new Set(docs.map((d) => d.collection));
    const chunksCount = docs.reduce((acc, d) => acc + d.chunks.length, 0);

    return deepFreeze({
      id: this.id,
      name: this.name,
      collectionsCount: collections.size,
      documentsCount: docs.length,
      chunksCount,
      timestamp: new Date(),
      metadata: this.metadata,
    });
  }
}
