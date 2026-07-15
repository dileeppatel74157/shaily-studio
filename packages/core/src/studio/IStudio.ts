import { IRuntime } from "../runtime/IRuntime";
import { IHost } from "../host/IHost";
import { IBootstrapper } from "../bootstrap/IBootstrapper";
import { IKernel } from "../kernel/IKernel";
import { IConfiguration } from "../configuration/IConfiguration";
import { ISecurity } from "../security/ISecurity";
import { IObservability } from "../observability/IObservability";
import { IStorage } from "../storage/IStorage";
import { IScheduler } from "../scheduler/IScheduler";
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
  readonly gateway: unknown;
  readonly mcp: unknown;
  readonly messageBus: unknown;
  readonly knowledgeBase: unknown;
  readonly promptRegistry: unknown;
  readonly rag: unknown;

  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  snapshot(): StudioSnapshot;
}
