import { IDailyAutomationEngine } from "./interfaces";
import { DailyAutomationEngine } from "./DailyAutomationEngine";
import { DailyAutomationException } from "./exceptions";

export class DailyAutomationBuilder {
  private _context?: any;

  public withContext(context: any): this {
    this._context = context;
    return this;
  }

  public build(): IDailyAutomationEngine {
    if (!this._context) {
      throw new DailyAutomationException("Context is required to build DailyAutomationEngine.");
    }
    return new DailyAutomationEngine(this._context);
  }
}
