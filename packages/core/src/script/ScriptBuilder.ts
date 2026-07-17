import { ScriptEngine } from "./ScriptEngine";
import {
  IStoryEngine,
  IHookEngine,
  IScenePlanner,
  IDialogueEngine,
} from "./interfaces";

export class ScriptBuilder {
  private _context?: any;
  private _configuration?: any;
  private _metadata: Record<string, unknown> = {};
  private _storyEngine?: IStoryEngine;
  private _hookEngine?: IHookEngine;
  private _scenePlanner?: IScenePlanner;
  private _dialogueEngine?: IDialogueEngine;

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

  public withStoryEngine(engine: IStoryEngine): this {
    this._storyEngine = engine;
    return this;
  }

  public withHookEngine(engine: IHookEngine): this {
    this._hookEngine = engine;
    return this;
  }

  public withScenePlanner(planner: IScenePlanner): this {
    this._scenePlanner = planner;
    return this;
  }

  public withDialogueEngine(engine: IDialogueEngine): this {
    this._dialogueEngine = engine;
    return this;
  }

  public build(): ScriptEngine {
    if (!this._context) {
      throw new Error("Context is required to build a ScriptEngine.");
    }
    return new ScriptEngine(
      this._context,
      this._configuration,
      this._metadata,
      this._storyEngine,
      this._hookEngine,
      this._scenePlanner,
      this._dialogueEngine
    );
  }
}
