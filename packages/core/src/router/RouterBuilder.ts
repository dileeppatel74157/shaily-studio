import { LLMRouter } from "./LLMRouter";
import { RouterContext } from "./RouterContext";

export class RouterBuilder {
  private _context?: RouterContext;

  public withContext(context: RouterContext): this {
    this._context = context;
    return this;
  }

  public build(): LLMRouter {
    if (!this._context) {
      throw new Error("Router context is required to build LLMRouter.");
    }
    return new LLMRouter(this._context);
  }
}
