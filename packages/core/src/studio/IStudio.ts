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

export interface IStudio {
  readonly runtime: IRuntime;
  readonly host: IHost;
  readonly bootstrapper: IBootstrapper;
  readonly kernel: IKernel;
  readonly configuration: IConfiguration;
  readonly security: ISecurity;
  readonly observability: IObservability;
  readonly storage: IStorage;
  readonly scheduler: IScheduler;
  readonly gateway: IGateway;
  readonly mcp: IMCPServer;
  readonly messageBus: IMessageBus;
  readonly knowledgeBase: IKnowledgeBase;
  readonly promptRegistry: IPromptRegistry;
  readonly rag: IRAGEngine;


  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  snapshot(): StudioSnapshot;
}
