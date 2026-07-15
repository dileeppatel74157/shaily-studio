import { IStudio } from "./IStudio";
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
import { StudioSnapshot } from "./StudioSnapshot";
import { StudioContext } from "./StudioContext";
import { StudioState } from "./StudioState";
import { StudioValidator } from "./StudioValidator";
import {
  StudioValidationException,
  InvalidStudioStateException,
  deepFreeze,
} from "./types";

export class Studio implements IStudio {
  public readonly runtime: IRuntime;
  public readonly host: IHost;
  public readonly bootstrapper: IBootstrapper;
  public readonly kernel: IKernel;
  public readonly configuration: IConfiguration;
  public readonly security: ISecurity;
  public readonly observability: IObservability;
  public readonly storage: IStorage;
  public readonly scheduler: IScheduler;
  public readonly gateway: IGateway;
  public readonly mcp: IMCPServer;
  public readonly messageBus: IMessageBus;
  public readonly knowledgeBase: IKnowledgeBase;
  public readonly promptRegistry: IPromptRegistry;
  public readonly rag: IRAGEngine;

  private readonly _context: StudioContext;
  private readonly _metadata: Readonly<Record<string, unknown>>;
  private _state: StudioState = StudioState.CREATED;

  constructor(
    context: StudioContext,
    frameworks: {
      runtime: IRuntime;
      host: IHost;
      bootstrapper: IBootstrapper;
      kernel: IKernel;
      configuration: IConfiguration;
      security: ISecurity;
      observability: IObservability;
      storage: IStorage;
      scheduler: IScheduler;
      gateway: IGateway;
      mcp: IMCPServer;
      messageBus: IMessageBus;
      knowledgeBase: IKnowledgeBase;
      promptRegistry: IPromptRegistry;
      rag: IRAGEngine;
    },
    metadata?: Record<string, unknown>
  ) {
    StudioValidator.validateContext(context);
    
    // Check all required dependencies exist
    const required = [
      "runtime",
      "host",
      "bootstrapper",
      "kernel",
      "configuration",
      "security",
      "observability",
      "storage",
      "scheduler",
    ] as const;
    for (const key of required) {
      if (!frameworks[key]) {
        throw new StudioValidationException(`Missing required dependency: "${key}"`);
      }
    }

    this.runtime = frameworks.runtime;
    this.host = frameworks.host;
    this.bootstrapper = frameworks.bootstrapper;
    this.kernel = frameworks.kernel;
    this.configuration = frameworks.configuration;
    this.security = frameworks.security;
    this.observability = frameworks.observability;
    this.storage = frameworks.storage;
    this.scheduler = frameworks.scheduler;
    this.gateway = frameworks.gateway;
    this.mcp = frameworks.mcp;
    this.messageBus = frameworks.messageBus;
    this.knowledgeBase = frameworks.knowledgeBase;
    this.promptRegistry = frameworks.promptRegistry;
    this.rag = frameworks.rag;

    this._context = context;
    this._metadata = metadata ? { ...metadata } : {};
  }

  public async initialize(): Promise<void> {
    if (this._state !== StudioState.CREATED) {
      throw new InvalidStudioStateException("initialize", this._state);
    }
    this._state = StudioState.INITIALIZING;
    try {
      await this.runtime.initialize();
      this._state = StudioState.READY;
    } catch (err) {
      this._state = StudioState.FAILED;
      throw err;
    }
  }

  public async start(): Promise<void> {
    if (this._state !== StudioState.READY) {
      throw new InvalidStudioStateException("start", this._state);
    }
    try {
      await this.runtime.start();
      this._state = StudioState.RUNNING;
    } catch (err) {
      this._state = StudioState.FAILED;
      throw err;
    }
  }

  public async stop(): Promise<void> {
    if (this._state !== StudioState.RUNNING) {
      throw new InvalidStudioStateException("stop", this._state);
    }
    try {
      await this.runtime.stop();
      this._state = StudioState.STOPPED;
    } catch (err) {
      this._state = StudioState.FAILED;
      throw err;
    }
  }

  public snapshot(): StudioSnapshot {
    if (this._state !== StudioState.RUNNING && this._state !== StudioState.STOPPED) {
      throw new InvalidStudioStateException("snapshot", this._state);
    }

    const snapshotObj: StudioSnapshot = {
      timestamp: new Date(),
      state: this._state,
      runtime: this.runtime.snapshot(),
      host: this.host.snapshot(),
      bootstrapper: this.bootstrapper.snapshot(),
      kernel: this.kernel.snapshot(),
      registeredFrameworks: [
        "configuration",
        "security",
        "observability",
        "storage",
        "scheduler",
        "gateway",
        "mcp",
        "messageBus",
        "knowledgeBase",
        "promptRegistry",
        "rag",
      ].filter((f) => !!(this as any)[f]),
      metadata: { ...this._context.metadata, ...this._metadata },
      capabilities: ["COMPOSITION_ROOT", "STATE_LIFECYCLE", "IMMUTABILITY"],
    };

    return deepFreeze(snapshotObj);
  }
}
