import { IProvider } from "./IProvider";
import { ProviderType } from "./ProviderType";
import { ProviderFeature } from "./ProviderFeature";
import { ProviderState } from "./ProviderState";
import { ProviderHealth } from "./ProviderHealth";
import { ProviderRequest } from "./ProviderRequest";
import { ProviderResponse, ProviderResponseChunk } from "./ProviderResponse";
import { ProviderSnapshot } from "./ProviderSnapshot";
import { ProviderContext } from "./ProviderContext";
import { ProviderConfiguration } from "./ProviderConfiguration";
import { InvalidProviderStateException, deepFreeze } from "./types";
import { ProviderValidator } from "./ProviderValidator";
import { ProviderMetadata } from "./ProviderMetadata";
import { ModelDescriptor } from "../router/ModelDescriptor";

export interface ProviderHandler {
  initialize?(context: ProviderContext): Promise<void>;
  execute(context: ProviderContext, request: ProviderRequest): Promise<ProviderResponse>;
  health?(
    context: ProviderContext
  ): Promise<{ isHealthy: boolean; details?: Record<string, unknown> }>;
}

export abstract class Provider implements IProvider {
  protected _state: ProviderState = ProviderState.CREATED;
  protected _successfulRequests = 0;
  protected _failedRequests = 0;
  protected _lastSuccessfulRequest: Date | null = null;
  protected _lastFailure: Date | null = null;
  protected _totalLatency = 0;
  protected _healthDetails: Record<string, any> = {};


  public readonly id: string;
  public readonly name: string;
  public readonly type: ProviderType;
  public readonly capabilities: readonly ProviderFeature[];
  public readonly context: ProviderContext;
  public readonly configuration: ProviderConfiguration;
  public readonly metadata: ProviderMetadata;
  private readonly _handler?: ProviderHandler;
  private readonly _customMetadata?: Record<string, unknown>;


  constructor(...args: any[]) {
    if (typeof args[0] === "object" && args[0] !== null && "id" in args[0] && !("models" in args[0])) {
      // Old constructor: (metadata: ProviderMetadata, context: ProviderContext, handler: ProviderHandler, customMetadata?: Record<string, unknown>)
      const meta = args[0] as ProviderMetadata;
      this.context = args[1] as ProviderContext;
      this._handler = args[2] as ProviderHandler;
      const customMeta = args[3] || {};
      
      this.id = meta.id || "default-id";
      this.name = meta.name || "default-name";
      this.type = ProviderType.CHAT; // Default for old
      
      // Map old capabilities to new capabilities array
      const caps: ProviderFeature[] = [];
      if (meta.capabilities) {
        if ((meta.capabilities as any).streaming) caps.push(ProviderFeature.Streaming);
        if ((meta.capabilities as any).jsonMode) caps.push(ProviderFeature.JSONMode);
        if ((meta.capabilities as any).toolCalling) caps.push(ProviderFeature.Tools);
        if ((meta.capabilities as any).vision) caps.push(ProviderFeature.Vision);
        if ((meta.capabilities as any).imageGeneration) caps.push(ProviderFeature.Images);
        if ((meta.capabilities as any).audioInput) caps.push(ProviderFeature.Audio);
      }
      this.capabilities = caps;
      this.configuration = { models: [], settings: {} };
      this.metadata = meta;
      this._customMetadata = customMeta;
    } else {
      // New constructor: (id, name, type, capabilities, context, configuration, metadata)
      this.id = args[0];
      this.name = args[1];
      this.type = args[2];
      this.capabilities = args[3];
      this.context = args[4];
      this.configuration = args[5];
      this.metadata = {
        version: "1.0.0",
        metadata: args[6] || {},
      };
    }
  }

  public get version(): string {
    return this.metadata.version || "1.0.0";
  }

  public get state(): ProviderState {
    return this._state;
  }

  public async initialize(): Promise<void> {
    if (this._state !== ProviderState.CREATED) {
      throw new InvalidProviderStateException("initialize", this._state);
    }
    this._state = ProviderState.INITIALIZING;
    try {
      if (this._handler?.initialize) {
        await this._handler.initialize(this.context);
      }
      if (this._handler?.health) {
        try {
          const handlerHealth = await this._handler.health(this.context);
          this._healthDetails = handlerHealth.details || {};
        } catch (_) {}
      }
      this._state = ProviderState.READY;
    } catch (err) {
      this._state = ProviderState.CREATED;
      throw err;
    }
  }


  public async start(): Promise<void> {
    if (this._state !== ProviderState.READY) {
      throw new InvalidProviderStateException("start", this._state);
    }
    this._state = ProviderState.RUNNING;
  }

  public async stop(): Promise<void> {
    if (this._state !== ProviderState.RUNNING) {
      throw new InvalidProviderStateException("stop", this._state);
    }
    this._state = ProviderState.STOPPED;
  }

  public health(): ProviderHealth {
    const total = this._successfulRequests + this._failedRequests;
    const errorRate = total === 0 ? 0 : this._failedRequests / total;
    const availability = total === 0 ? 1 : this._successfulRequests / total;
    const avgLatency = this._successfulRequests === 0 ? 0 : this._totalLatency / this._successfulRequests;

    const h: ProviderHealth = {
      status: errorRate > 0.5 ? "UNHEALTHY" : errorRate > 0.1 ? "DEGRADED" : "HEALTHY",
      latency: avgLatency,
      lastSuccessfulRequest: this._lastSuccessfulRequest,
      lastFailure: this._lastFailure,
      errorRate,
      availability,
      // Backward compatibility fields
      isHealthy: errorRate <= 0.1,
      details: { state: this._state, ...this._healthDetails },
    };
    return deepFreeze(h);
  }



  public async execute(request: ProviderRequest): Promise<ProviderResponse> {
    // Note: The old design allowed execution while in READY state.
    // To support both, we check if state is either READY or RUNNING.
    if (this._state !== ProviderState.RUNNING && this._state !== ProviderState.READY) {
      throw new InvalidProviderStateException("execute", this._state);
    }

    let mappedRequest = { ...request };
    if (!mappedRequest.requestId) {
      (mappedRequest as any).requestId = "req-" + Date.now();
    }
    if (!mappedRequest.providerId) {
      (mappedRequest as any).providerId = this.id;
    }
    if (!mappedRequest.model) {
      (mappedRequest as any).model = "default-model";
    }
    if (!mappedRequest.messages) {
      (mappedRequest as any).messages = request.messages || (request.prompt ? [{ role: "user", content: request.prompt }] : []);
    }

    ProviderValidator.validateRequest(mappedRequest, this);

    const startTime = Date.now();
    try {
      let response: ProviderResponse;
      if (this._handler) {
        response = await this._handler.execute(this.context, mappedRequest);
      } else {
        response = await this.performExecute(mappedRequest);
      }

      if (response.content && !response.text) {
        (response as any).text = response.content;
      }
      if (response.text && !response.content) {
        (response as any).content = response.text;
      }

      if (this._handler?.health) {
        this._handler.health(this.context).then((handlerHealth) => {
          this._healthDetails = handlerHealth.details || {};
        }).catch(() => {});
      }

      ProviderValidator.validateResponse(response, this);
      this._successfulRequests++;
      this._lastSuccessfulRequest = new Date();
      this._totalLatency += Date.now() - startTime;
      return response;
    } catch (err) {
      this._failedRequests++;
      this._lastFailure = new Date();
      throw err;
    }
  }


  public snapshot(): ProviderSnapshot {
    // Construct capabilities array
    const capsArray: any = [...this.capabilities];
    
    // Map capabilities flags to array properties for backward compatibility
    capsArray.chat = this.capabilities.includes(ProviderFeature.Streaming) || this.capabilities.includes(ProviderFeature.JSONMode) || !this.capabilities.includes(ProviderFeature.Embeddings);
    capsArray.vision = this.capabilities.includes(ProviderFeature.Vision);
    capsArray.imageGeneration = this.capabilities.includes(ProviderFeature.Images);
    capsArray.audioInput = this.capabilities.includes(ProviderFeature.Audio);
    capsArray.audioOutput = this.capabilities.includes(ProviderFeature.Audio);
    capsArray.toolCalling = this.capabilities.includes(ProviderFeature.Tools) || this.capabilities.includes(ProviderFeature.FunctionCalling);
    capsArray.jsonMode = this.capabilities.includes(ProviderFeature.JSONMode);
    capsArray.streaming = this.capabilities.includes(ProviderFeature.Streaming);

    const snap: ProviderSnapshot = {
      descriptor: {
        id: this.id,
        name: this.name,
        type: this.type,
        capabilities: this.capabilities,
      },
      configuration: this.configuration,
      metadata: this._customMetadata || (this.metadata.metadata || {}) as any,
      health: this.health(),
      capabilities: capsArray,
      lifecycle: this._state,
      // Backward compatibility fields
      id: this.id,
      name: this.name,
      version: this.version,
      state: this._state,
      timestamp: new Date(),
    };
    return deepFreeze(snap);
  }


  public abstract get models(): readonly ModelDescriptor[];

  public async *stream(request: ProviderRequest): AsyncGenerator<ProviderResponseChunk> {
    if (this._state !== ProviderState.RUNNING && this._state !== ProviderState.READY) {
      throw new InvalidProviderStateException("stream", this._state);
    }
    ProviderValidator.validateRequest(request, this);
    yield* this.performStream(request);
  }

  protected abstract performExecute(request: ProviderRequest): Promise<ProviderResponse>;
  protected abstract performStream(request: ProviderRequest): AsyncGenerator<ProviderResponseChunk>;
}
