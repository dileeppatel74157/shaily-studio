import { IStudio } from "./IStudio";
import { Studio } from "./Studio";
import { StudioContext } from "./StudioContext";
import { IRuntime } from "../runtime/IRuntime";
import { IHost } from "../host/IHost";
import { IBootstrapper } from "../bootstrap/IBootstrapper";
import { IKernel } from "../kernel/IKernel";
import { IConfiguration } from "../configuration/IConfiguration";
import { ISecurity } from "../security/ISecurity";
import { IObservability } from "../observability/IObservability";
import { IStorage } from "../storage/IStorage";
import { IScheduler } from "../scheduler/IScheduler";
import { IGateway } from "../gateway/IGateway";
import { IMCPServer } from "../mcp/IMCPServer";
import { IMessageBus } from "../messagebus/IMessageBus";
import { IKnowledgeBase } from "../knowledge/IKnowledgeBase";
import { IPromptRegistry } from "../prompts/IPromptRegistry";
import { IRAGEngine } from "../rag/IRAGEngine";
import { StudioValidationException } from "./types";

export class StudioBuilder {
  private _context?: StudioContext;
  private _runtime?: IRuntime;
  private _host?: IHost;
  private _bootstrapper?: IBootstrapper;
  private _kernel?: IKernel;
  private _configuration?: IConfiguration;
  private _security?: ISecurity;
  private _observability?: IObservability;
  private _storage?: IStorage;
  private _scheduler?: IScheduler;
  private _gateway?: IGateway;
  private _mcp?: IMCPServer;
  private _messageBus?: IMessageBus;
  private _knowledgeBase?: IKnowledgeBase;
  private _promptRegistry?: IPromptRegistry;
  private _rag?: IRAGEngine;
  private _metadata: Record<string, unknown> = {};

  public withContext(context: StudioContext): this {
    this._context = context;
    return this;
  }

  public withRuntime(runtime: IRuntime): this {
    this._runtime = runtime;
    return this;
  }

  public withHost(host: IHost): this {
    this._host = host;
    return this;
  }

  public withBootstrapper(bootstrapper: IBootstrapper): this {
    this._bootstrapper = bootstrapper;
    return this;
  }

  public withKernel(kernel: IKernel): this {
    this._kernel = kernel;
    return this;
  }

  public withConfiguration(configuration: IConfiguration): this {
    this._configuration = configuration;
    return this;
  }

  public withSecurity(security: ISecurity): this {
    this._security = security;
    return this;
  }

  public withObservability(observability: IObservability): this {
    this._observability = observability;
    return this;
  }

  public withStorage(storage: IStorage): this {
    this._storage = storage;
    return this;
  }

  public withScheduler(scheduler: IScheduler): this {
    this._scheduler = scheduler;
    return this;
  }

  public withGateway(gateway: IGateway): this {
    this._gateway = gateway;
    return this;
  }

  public withMCP(mcp: IMCPServer): this {
    this._mcp = mcp;
    return this;
  }

  public withMessageBus(messageBus: IMessageBus): this {
    this._messageBus = messageBus;
    return this;
  }

  public withKnowledgeBase(knowledgeBase: IKnowledgeBase): this {
    this._knowledgeBase = knowledgeBase;
    return this;
  }

  public withPromptRegistry(promptRegistry: IPromptRegistry): this {
    this._promptRegistry = promptRegistry;
    return this;
  }

  public withRAG(rag: IRAGEngine): this {
    this._rag = rag;
    return this;
  }

  public withMetadata(metadata: Record<string, unknown>): this {
    this._metadata = { ...this._metadata, ...metadata };
    return this;
  }

  public build(): IStudio {
    if (!this._context) {
      throw new StudioValidationException("StudioContext is required to build Studio.");
    }

    return new Studio(
      this._context,
      {
        runtime: this._runtime!,
        host: this._host!,
        bootstrapper: this._bootstrapper!,
        kernel: this._kernel!,
        configuration: this._configuration!,
        security: this._security!,
        observability: this._observability!,
        storage: this._storage!,
        scheduler: this._scheduler!,
        gateway: this._gateway!,
        mcp: this._mcp!,
        messageBus: this._messageBus!,
        knowledgeBase: this._knowledgeBase!,
        promptRegistry: this._promptRegistry!,
        rag: this._rag!,
      },
      this._metadata
    );
  }
}

