import { IProvider } from "./IProvider";
import { ProviderMetadata } from "./ProviderMetadata";
import { ProviderState } from "./ProviderState";
import { ProviderRequest } from "./ProviderRequest";
import { ProviderResponse } from "./ProviderResponse";
import { ProviderSnapshot } from "./ProviderSnapshot";
import { ProviderContext } from "./ProviderContext";
import { InvalidProviderStateException } from "./types";

export interface ProviderHandler {
  initialize?(context: ProviderContext): Promise<void>;
  execute(context: ProviderContext, request: ProviderRequest): Promise<ProviderResponse>;
  health?(
    context: ProviderContext
  ): Promise<{ isHealthy: boolean; details?: Record<string, unknown> }>;
}

export class Provider implements IProvider {
  private _state: ProviderState = ProviderState.CREATED;
  private readonly _customMetadata: Record<string, unknown>;

  constructor(
    public readonly metadata: ProviderMetadata,
    public readonly context: ProviderContext,
    private readonly _handler: ProviderHandler,
    customMetadata: Record<string, unknown> = {}
  ) {
    this._customMetadata = { ...customMetadata };
  }

  public get id(): string {
    return this.metadata.id;
  }

  public get name(): string {
    return this.metadata.name;
  }

  public get version(): string {
    return this.metadata.version;
  }

  public get state(): ProviderState {
    return this._state;
  }

  public async initialize(): Promise<void> {
    if (this._state !== ProviderState.CREATED) {
      throw new InvalidProviderStateException(this.id, "initialize", this._state);
    }
    this.context.logger.info(`Initializing AI provider: ${this.name} (${this.id})`);
    try {
      if (this._handler.initialize) {
        await this._handler.initialize(this.context);
      }
      this._state = ProviderState.READY;
    } catch (err: any) {
      this._state = ProviderState.FAILED;
      this.context.logger.error(`AI provider initialization failed: ${this.name}`, {}, err);
      throw err;
    }
  }

  public async execute(request: ProviderRequest): Promise<ProviderResponse> {
    if (this._state !== ProviderState.READY && this._state !== ProviderState.RUNNING) {
      throw new InvalidProviderStateException(this.id, "execute", this._state);
    }

    const prevState = this._state;
    this._state = ProviderState.RUNNING;
    this.context.logger.info(`Executing AI provider request on: ${this.name} (${this.id})`);

    try {
      const response = await this._handler.execute(this.context, request);
      this._state = prevState;
      return response;
    } catch (err: any) {
      this._state = ProviderState.FAILED;
      this.context.logger.error(`AI provider execution failed: ${this.name}`, {}, err);
      throw err;
    }
  }

  public async health(): Promise<{ isHealthy: boolean; details?: Record<string, unknown> }> {
    if (this._state === ProviderState.FAILED) {
      return { isHealthy: false, details: { state: this._state } };
    }
    try {
      if (this._handler.health) {
        return await this._handler.health(this.context);
      }
      return { isHealthy: true, details: { state: this._state } };
    } catch (err: any) {
      return { isHealthy: false, details: { error: err.message, state: this._state } };
    }
  }

  public snapshot(): ProviderSnapshot {
    return Object.freeze({
      id: this.id,
      name: this.name,
      version: this.version,
      state: this._state,
      capabilities: Object.freeze({ ...this.metadata.capabilities }),
      metadata: Object.freeze(JSON.parse(JSON.stringify(this._customMetadata))),
      timestamp: new Date(),
    });
  }
}
