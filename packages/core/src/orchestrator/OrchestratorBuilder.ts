import { Orchestrator } from "./Orchestrator";
import { OrchestratorContext } from "./OrchestratorContext";

export class OrchestratorBuilder {
  private _context?: OrchestratorContext;

  public withContext(context: OrchestratorContext): this {
    this._context = context;
    return this;
  }

  public build(): Orchestrator {
    if (!this._context) {
      throw new Error("Orchestrator context is required to build Orchestrator.");
    }
    return new Orchestrator(this._context);
  }
}
