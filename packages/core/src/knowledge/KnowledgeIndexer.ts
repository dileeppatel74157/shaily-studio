import { KnowledgeDocument } from "./KnowledgeDocument";
import { KnowledgeValidator } from "./KnowledgeValidator";

export class KnowledgeIndexer {
  private readonly _validator = new KnowledgeValidator();

  public index(doc: KnowledgeDocument): void {
    this._validator.validateDocument(doc);
  }
}
