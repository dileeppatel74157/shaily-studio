import { KnowledgeDocument } from "../models/KnowledgeDocument";
import { KnowledgeValidator } from "../validation/KnowledgeValidator";

export class KnowledgeIndexer {
  private readonly _validator = new KnowledgeValidator();

  public index(doc: KnowledgeDocument): void {
    this._validator.validateDocument(doc);
  }
}
