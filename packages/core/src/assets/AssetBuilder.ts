import { AssetEngine } from "./AssetEngine";
import {
  IPromptEngine,
  IStyleEngine,
  ICharacterEngine,
  ITimelinePlanner,
} from "./interfaces";

export class AssetBuilder {
  private _context?: any;
  private _configuration?: any;
  private _metadata: Record<string, unknown> = {};
  private _promptEngine?: IPromptEngine;
  private _styleEngine?: IStyleEngine;
  private _characterEngine?: ICharacterEngine;
  private _timelinePlanner?: ITimelinePlanner;

  public withContext(context: any): this {
    this._context = context;
    return this;
  }

  public withConfiguration(configuration: any): this {
    this._configuration = configuration;
    return this;
  }

  public withMetadata(metadata: Record<string, unknown>): this {
    this._metadata = { ...metadata };
    return this;
  }

  public withPromptEngine(engine: IPromptEngine): this {
    this._promptEngine = engine;
    return this;
  }

  public withStyleEngine(engine: IStyleEngine): this {
    this._styleEngine = engine;
    return this;
  }

  public withCharacterEngine(engine: ICharacterEngine): this {
    this._characterEngine = engine;
    return this;
  }

  public withTimelinePlanner(planner: ITimelinePlanner): this {
    this._timelinePlanner = planner;
    return this;
  }

  public build(): AssetEngine {
    if (!this._context) {
      throw new Error("Context is required to build an AssetEngine.");
    }
    return new AssetEngine(
      this._context,
      this._configuration,
      this._metadata,
      this._promptEngine,
      this._styleEngine,
      this._characterEngine,
      this._timelinePlanner
    );
  }
}
