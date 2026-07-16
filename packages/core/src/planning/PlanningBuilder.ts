import { PlanningEngine } from "./PlanningEngine";
import { PlanningContext } from "./PlanningContext";
import { PlanningConfiguration } from "./PlanningConfiguration";

export class PlanningBuilder {
  private _context?: PlanningContext;
  private _configuration?: PlanningConfiguration;
  private _metadata: Record<string, unknown> = {};

  public withContext(context: PlanningContext): this {
    this._context = context;
    return this;
  }

  public withConfiguration(configuration: PlanningConfiguration): this {
    this._configuration = configuration;
    return this;
  }

  public withMetadata(metadata: Record<string, unknown>): this {
    this._metadata = { ...metadata };
    return this;
  }

  public build(): PlanningEngine {
    if (!this._context) {
      throw new Error("Context is required to build a PlanningEngine.");
    }
    return new PlanningEngine(this._context, this._configuration, this._metadata);
  }
}
