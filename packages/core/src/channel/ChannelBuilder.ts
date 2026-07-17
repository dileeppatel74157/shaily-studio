import { ChannelEngine } from "./ChannelEngine";
import {
  IBrandEngine,
  IBlueprintEngine,
  IPersonaEngine,
} from "./interfaces";

export class ChannelBuilder {
  private _context?: any;
  private _configuration?: any;
  private _metadata: Record<string, unknown> = {};
  private _brandEngine?: IBrandEngine;
  private _blueprintEngine?: IBlueprintEngine;
  private _personaEngine?: IPersonaEngine;

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

  public withBrandEngine(engine: IBrandEngine): this {
    this._brandEngine = engine;
    return this;
  }

  public withBlueprintEngine(engine: IBlueprintEngine): this {
    this._blueprintEngine = engine;
    return this;
  }

  public withPersonaEngine(engine: IPersonaEngine): this {
    this._personaEngine = engine;
    return this;
  }

  public build(): ChannelEngine {
    if (!this._context) {
      throw new Error("Context is required to build a ChannelEngine.");
    }
    return new ChannelEngine(
      this._context,
      this._configuration,
      this._metadata,
      this._brandEngine,
      this._blueprintEngine,
      this._personaEngine
    );
  }
}
