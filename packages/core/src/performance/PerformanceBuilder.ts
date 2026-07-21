import { IPerformanceEngine } from "./interfaces";
import { PerformanceEngine } from "./PerformanceEngine";
import { PerformanceException } from "./types";

export class PerformanceBuilder {
  private _context?: any;

  public withContext(context: any): this {
    this._context = context;
    return this;
  }

  public build(): IPerformanceEngine {
    if (!this._context) {
      throw new PerformanceException("Context is required to build PerformanceEngine.");
    }
    return new PerformanceEngine(this._context);
  }
}
