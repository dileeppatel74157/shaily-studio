import { RuntimeState } from "./RuntimeState";
import { EngineState } from "./EngineState";
import { ServiceType } from "./ServiceType";
import { HealthStatus } from "./HealthStatus";
import { RuntimeEventType } from "./RuntimeEventType";
import { StartupPriority } from "./StartupPriority";
import { SchedulerState } from "./SchedulerState";
import { HeartbeatStatus } from "./HeartbeatStatus";

export interface RuntimeRequest {
  id: string;
  targetState: RuntimeState;
  force?: boolean;
  timestamp: Date;
}

export interface RuntimeResponse {
  id: string;
  success: boolean;
  error?: string;
  timestamp: Date;
}

export interface RuntimeConfiguration {
  env: string;
  heartbeatIntervalMs: number;
  healthCheckIntervalMs: number;
  schedulerIntervalMs?: number;
  startupTimeoutMs: number;
  shutdownTimeoutMs: number;
  metadata?: Record<string, unknown>;
}

export interface RuntimeMetrics {
  startupTimeMs: number;
  shutdownTimeMs: number;
  cpuUsagePercent: number;
  memoryUsageBytes: number;
  gpuUsagePercent?: number;
  providerLatencyMs: Record<string, number>;
  engineCount: number;
  runningJobs: number;
  tokenUsage: number;
}

export interface RuntimeHealth {
  status: HealthStatus;
  score: number; // 0 to 100
  engines: Record<string, HealthStatus>;
  lastChecked: Date;
}

export interface EngineDependency {
  engineId: string;
  dependsOn: string;
  optional?: boolean;
}

export interface EngineRegistration {
  id: string;
  engine: any; // Engine instance
  dependencies: string[];
  priority: StartupPriority;
  metadata?: Record<string, unknown>;
}

export interface EngineDescriptor {
  id: string;
  state: EngineState;
  dependencies: string[];
  priority: StartupPriority;
  health: HealthStatus;
  metrics?: {
    cpu: number;
    memory: number;
    queueLength: number;
    latencyMs: number;
    errorsCount: number;
  };
}

export interface ServiceRegistration {
  id: string;
  type: ServiceType;
  service: any; // Service instance
  metadata?: Record<string, unknown>;
}

export interface ServiceDescriptor {
  id: string;
  type: ServiceType;
  state: EngineState;
  metadata?: Record<string, unknown>;
}

export interface Heartbeat {
  timestamp: Date;
  engineId: string;
  status: HeartbeatStatus;
  metrics?: {
    cpu: number;
    memory: number;
  };
}

export interface HeartbeatHistory {
  engineId: string;
  heartbeats: Heartbeat[];
  missedCount: number;
  lastHeartbeat?: Date;
}

export interface HealthCheck {
  id: string;
  targetId: string;
  status: HealthStatus;
  score: number;
  message?: string;
  timestamp: Date;
}

export interface HealthReport {
  timestamp: Date;
  status: HealthStatus;
  score: number;
  checks: HealthCheck[];
}

export interface StartupSequence {
  startedAt: Date;
  completedAt?: Date;
  order: string[];
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  error?: string;
}

export interface ShutdownSequence {
  startedAt: Date;
  completedAt?: Date;
  order: string[];
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  error?: string;
}

export interface SchedulerJob {
  id: string;
  cronExpression?: string;
  intervalMs?: number;
  priority: StartupPriority;
  task: (context: any) => Promise<void>;
  metadata?: Record<string, unknown>;
}

export interface SchedulerTask {
  id: string;
  jobId: string;
  state: SchedulerState;
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  errorCount: number;
}

export interface SchedulerReport {
  timestamp: Date;
  state: SchedulerState;
  activeJobs: SchedulerTask[];
}

export interface RuntimeStatistics {
  uptimeMs: number;
  totalTokens: number;
  averageLatencyMs: number;
  errorRate: number;
}

export interface RuntimeEvent {
  type: RuntimeEventType;
  timestamp: Date;
  payload?: any;
}

export interface RuntimeStateSnapshot {
  timestamp: Date;
  state: RuntimeState;
  reason?: string;
}

export interface RuntimeSnapshot {
  timestamp: Date;
  state: RuntimeState;
  metrics: RuntimeMetrics;
  health: RuntimeHealth;
  engines: EngineDescriptor[];
  services: ServiceDescriptor[];
  scheduler: SchedulerReport;
  metadata?: Record<string, unknown>;
}

export interface RuntimeReport {
  timestamp: Date;
  runtimeId: string;
  state: RuntimeState;
  uptimeS: number;
  metrics: RuntimeMetrics;
  health: RuntimeHealth;
  engines: { id: string; state: EngineState; health: HealthStatus }[];
  scheduler: { activeJobsCount: number; runCount: number };
}
