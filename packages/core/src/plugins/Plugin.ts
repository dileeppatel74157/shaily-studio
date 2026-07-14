import { IPlugin } from "./IPlugin";
import { PluginMetadata } from "./PluginMetadata";
import { PluginContext } from "./PluginContext";
import { PluginState } from "./PluginState";
import { PluginSnapshot } from "./PluginSnapshot";
import { IPluginLifecycle, InvalidPluginStateException } from "./types";

export class Plugin implements IPlugin {
  private _state: PluginState = PluginState.CREATED;

  constructor(
    public readonly metadata: PluginMetadata,
    public readonly context: PluginContext,
    private readonly _delegate: IPluginLifecycle
  ) {
    Object.freeze(this.metadata);
    // Note: freeze capabilities list inside metadata too
    if (this.metadata.capabilities) {
      Object.freeze(this.metadata.capabilities);
    }
    Object.freeze(this.context);
  }

  public get state(): PluginState {
    return this._state;
  }

  public async initialize(): Promise<void> {
    if (this._state !== PluginState.CREATED) {
      throw new InvalidPluginStateException("initialize", this._state);
    }

    try {
      await this._delegate.initialize(this.context);
      this._state = PluginState.READY;
    } catch (err) {
      this._state = PluginState.FAILED;
      throw err;
    }
  }

  public async start(): Promise<void> {
    if (this._state !== PluginState.READY) {
      throw new InvalidPluginStateException("start", this._state);
    }

    try {
      await this._delegate.start(this.context);
      this._state = PluginState.RUNNING;
    } catch (err) {
      this._state = PluginState.FAILED;
      throw err;
    }
  }

  public async stop(): Promise<void> {
    if (this._state !== PluginState.RUNNING) {
      throw new InvalidPluginStateException("stop", this._state);
    }

    try {
      await this._delegate.stop(this.context);
      this._state = PluginState.STOPPED;
    } catch (err) {
      this._state = PluginState.FAILED;
      throw err;
    }
  }

  public snapshot(): PluginSnapshot {
    return Object.freeze({
      id: this.metadata.id,
      state: this._state,
      metadata: this.metadata,
      timestamp: new Date(),
    });
  }
}
