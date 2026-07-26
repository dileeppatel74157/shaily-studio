import { RuntimeState } from "../models/RuntimeState";
import { EngineState } from "../models/EngineState";
import { ServiceType } from "../models/ServiceType";
import { HealthStatus } from "../models/HealthStatus";
import { RuntimeEventType } from "../models/RuntimeEventType";
import { StartupPriority } from "../models/StartupPriority";
import { SchedulerState } from "../models/SchedulerState";
import { HeartbeatStatus } from "../models/HeartbeatStatus";
import {
  RuntimeRequest,
  RuntimeResponse,
  RuntimeConfiguration,
  RuntimeSnapshot,
  RuntimeReport,
  RuntimeMetrics,
  RuntimeHealth,
  EngineRegistration,
  EngineDescriptor,
  EngineDependency,
  ServiceRegistration,
  ServiceDescriptor,
  Heartbeat,
  HeartbeatHistory,
  HealthCheck,
  HealthReport,
  StartupSequence,
  ShutdownSequence,
  SchedulerJob,
  SchedulerTask,
  SchedulerReport,
  RuntimeStatistics,
  RuntimeEvent,
  RuntimeStateSnapshot
} from "../models/models";

export interface IRuntimeEngine {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  
  registerEngine(registration: EngineRegistration): void;
  registerService(registration: ServiceRegistration): void;
  
  getEngine<T>(id: string): T;
  getService<T>(id: string): T;
  
  getSnapshot(): RuntimeSnapshot;
  getState(): RuntimeState;
  
  on(eventType: RuntimeEventType, handler: (event: RuntimeEvent) => void): void;
  off(eventType: RuntimeEventType, handler: (event: RuntimeEvent) => void): void;
  emit(eventType: RuntimeEventType, payload?: any): void;
  
  getScheduler(): IScheduler;
  getRegistry(): IServiceRegistry;
  getHealthMonitor(): IHealthMonitor;
  getHeartbeatManager(): IHeartbeatManager;
  getStartupManager(): IStartupManager;
  getShutdownManager(): IShutdownManager;
  getReporter(): IRuntimeReporter;
  
  getContext(): any;
  getConfig(): RuntimeConfiguration;
}

export interface IServiceRegistry {
  register(id: string, type: ServiceType, instance: any, metadata?: Record<string, any>): void;
  unregister(id: string): void;
  get<T>(id: string): T;
  has(id: string): boolean;
  list(): ServiceDescriptor[];
}

export interface IHealthMonitor {
  checkHealth(): Promise<HealthReport>;
  getHealthReport(): HealthReport;
  updateHealth(id: string, status: HealthStatus, details?: any): void;
}

export interface IHeartbeatManager {
  startHeartbeat(): void;
  stopHeartbeat(): void;
  recordHeartbeat(engineId: string, status: HeartbeatStatus, metrics?: any): void;
  getHeartbeatHistory(engineId: string): HeartbeatHistory;
}

export interface IStartupManager {
  determineStartupOrder(engines: EngineDescriptor[]): string[];
  executeStartup(engines: Map<string, EngineRegistration>): Promise<StartupSequence>;
}

export interface IShutdownManager {
  executeShutdown(engines: Map<string, EngineRegistration>): Promise<ShutdownSequence>;
}

export interface IScheduler {
  scheduleJob(job: SchedulerJob): void;
  unscheduleJob(jobId: string): void;
  start(): void;
  stop(): void;
  getJobs(): SchedulerTask[];
}

export interface IEngineLoader {
  discoverEngines(): Promise<EngineRegistration[]>;
}

export interface IEngineResolver {
  resolveDependencies(registrations: EngineRegistration[]): string[];
}

export interface IRuntimeReporter {
  generateReport(): RuntimeReport;
  getMetrics(): RuntimeMetrics;
}
