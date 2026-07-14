import { IKnowledgeBase } from "./IKnowledgeBase";
import { KnowledgeBase } from "./KnowledgeBase";
import { KnowledgeDocument } from "./KnowledgeDocument";
import { KnowledgeValidationException } from "./types";

export class KnowledgeBuilder {
  private _id?: string;
  private _name?: string;
  private _metadata: Record<string, any> = {};
  private readonly _documents: KnowledgeDocument[] = [];
  private readonly _collections: string[] = [];

  public withId(id: string): this {
    this._id = id;
    return this;
  }

  public withName(name: string): this {
    this._name = name;
    return this;
  }

  public withCollection(collection: string): this {
    this._collections.push(collection);
    return this;
  }

  public withMetadata(metadata: Record<string, any>): this {
    this._metadata = { ...this._metadata, ...metadata };
    return this;
  }

  public withDocument(doc: KnowledgeDocument): this {
    this._documents.push(doc);
    return this;
  }

  public withDocuments(docs: readonly KnowledgeDocument[]): this {
    this._documents.push(...docs);
    return this;
  }

  public build(): IKnowledgeBase {
    if (!this._id || this._id.trim() === "") {
      throw new KnowledgeValidationException("KnowledgeBase ID cannot be empty.");
    }
    if (!this._name || this._name.trim() === "") {
      throw new KnowledgeValidationException("KnowledgeBase Name cannot be empty.");
    }

    const kb = new KnowledgeBase(this._id, this._name, this._metadata);
    for (const doc of this._documents) {
      kb.addDocument(doc);
    }
    return kb;
  }
}
