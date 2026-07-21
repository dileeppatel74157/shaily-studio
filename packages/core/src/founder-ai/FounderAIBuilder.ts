import { IFounderAIEngine } from "./interfaces";
import { FounderAIEngine } from "./FounderAIEngine";
import { FounderAIException } from "./exceptions";

export class FounderAIBuilder {
  private _context?: any;

  public withContext(context: any): this {
    this._context = context;
    return this;
  }

  public build(): IFounderAIEngine {
    if (!this._context) {
      throw new FounderAIException("Context is required to build FounderAIEngine.");
    }
    return new FounderAIEngine(this._context);
  }
}
