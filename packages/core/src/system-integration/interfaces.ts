import { IntegrationState } from "./IntegrationState";
import { IntegrationStatus } from "./IntegrationStatus";
import { EngineRegistrationState } from "./EngineRegistrationState";
import { DependencyStatus } from "./DependencyStatus";
import { SynchronizationState } from "./SynchronizationState";
import { HealthLevel } from "./HealthLevel";
import { RecoveryStrategy } from "./RecoveryStrategy";
import {
  IntegrationConfiguration,
  IntegrationRequest,
  IntegrationResponse,
  EngineDescriptor,
  EngineRegistration,
  DependencyGraph,
  IntegrationReport,
  IntegrationSnapshot,
  SynchronizationTask,
  SynchronizationReport,
  EventSubscription,
  EventPublication,
  SharedContextState,
  RuntimeStateReference,
  HealthSnapshot,
  RecoveryTask,
  RecoveryReport,
  SystemManifest,
  SystemSnapshot
} from "./models";

export interface IEngineRegistry {
  discoverEngines(): Promise<EngineDescriptor[]>;
  registerEngine(registration: EngineRegistration): void;
  getEngine(id: string): any;
  getRegistrations(): EngineRegistration[];
}

export interface IDependencyResolver {
  resolveDependencies(registrations: EngineRegistration[]): Promise<DependencyGraph>;
  verifyIntegrity(graph: DependencyGraph): void;
}

export interface IEventBus {
  publish(event: EventPublication): Promise<void>;
  subscribe(eventName: string, subscriberId: string, handler: (payload: any) => Promise<void> | void): EventSubscription;
  unsubscribe(subscriptionId: string): void;
  getHistory(): EventPublication[];
}

export interface IContextSynchronizer {
  synchronizeContexts(state: SharedContextState): Promise<void>;
  getContextState(): SharedContextState;
}

export interface IRuntimeSynchronizer {
  syncRuntimeState(ref: RuntimeStateReference): Promise<SynchronizationReport>;
  getRuntimeState(): RuntimeStateReference;
}

export interface IHealthMonitor {
  verifyHealth(): Promise<HealthSnapshot>;
  getHealthSnapshot(): HealthSnapshot;
}

export interface IRecoveryManager {
  executeRecovery(task: RecoveryTask): Promise<RecoveryReport>;
  getRecoveryHistory(): RecoveryReport[];
}

export interface IIntegrationReporter {
  generateReport(): Promise<IntegrationReport>;
  getSystemManifest(): SystemManifest;
}

export interface ISystemValidator {
  validate(snapshot: SystemSnapshot): Promise<{ isValid: boolean; issues: string[] }>;
}

export interface ISystemIntegrationEngine {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  
  getState(): IntegrationState;
  getSnapshot(): IntegrationSnapshot;
  getRegistry(): IEngineRegistry;
  getResolver(): IDependencyResolver;
  getEventBus(): IEventBus;
  getContextSynchronizer(): IContextSynchronizer;
  getRuntimeSynchronizer(): IRuntimeSynchronizer;
  getHealthMonitor(): IHealthMonitor;
  getRecoveryManager(): IRecoveryManager;
  getReporter(): IIntegrationReporter;
  getValidator(): ISystemValidator;
}
