import { SchedulerState } from "./SchedulerState";
import { TaskState } from "./TaskState";
import { ScheduleType } from "./ScheduleType";
import { TriggerType } from "./TriggerType";
import { RetryStrategy } from "./RetryStrategy";
import { QueuePriority } from "./QueuePriority";
import { DependencyState } from "./DependencyState";
import { SchedulerEventType } from "./SchedulerEventType";

export interface Scheduler {
  id: string;
  state: SchedulerState;
  createdAt: Date;
  updatedAt: Date;
}

export interface SchedulerRequest {
  taskId: string;
  action: "PAUSE" | "RESUME" | "CANCEL" | "TRIGGER";
  timestamp: Date;
}

export interface SchedulerResponse {
  taskId: string;
  success: boolean;
  state?: TaskState;
  error?: string;
  timestamp: Date;
}

export interface SchedulerConfiguration {
  concurrentLimit: number;
  checkIntervalMs: number;
  persistenceEnabled: boolean;
  maxQueueSize?: number;
  metadata?: Record<string, unknown>;
}

export interface SchedulerStatistics {
  uptimeMs: number;
  tasksExecuted: number;
  tasksCompleted: number;
  tasksFailed: number;
  tasksRetried: number;
  tasksSkipped: number;
  averageExecutionTimeMs: number;
}

export interface SchedulerSnapshot {
  timestamp: Date;
  state: SchedulerState;
  tasks: ScheduledTask[];
  queue: QueueItem[];
  metrics: SchedulerMetrics;
}

export interface ScheduledTask {
  id: string;
  name: string;
  state: TaskState;
  priority: QueuePriority;
  schedule: ScheduleRule;
  retryPolicy: RetryPolicy;
  dependencies: string[]; // dependsOnTaskIds
  targetPipelineId?: string;
  parameters: Record<string, any>;
  nextRunAt?: Date;
  lastRunAt?: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskExecution {
  id: string;
  taskId: string;
  workerId: string;
  state: TaskState;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface TaskQueue {
  items: QueueItem[];
  maxSize: number;
}

export interface QueueItem {
  taskId: string;
  priority: QueuePriority;
  queuedAt: Date;
}

export interface TaskHistory {
  id: string;
  taskId: string;
  state: TaskState;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  error?: string;
}

export interface ScheduleRule {
  type: ScheduleType;
  cronExpression?: string;
  intervalMs?: number;
  triggerType: TriggerType;
  eventName?: string;
  timeWindow?: TimeWindow;
}

export interface CronSchedule {
  expression: string;
  minutes: number[];
  hours: number[];
  daysOfMonth: number[];
  months: number[];
  daysOfWeek: number[];
}

export interface IntervalSchedule {
  intervalMs: number;
  startTime?: Date;
}

export interface TimeWindow {
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  timezone: string;
}

export interface TaskDependency {
  taskId: string;
  dependsOnTaskId: string;
}

export interface DependencyGraph {
  nodes: string[]; // task IDs
  edges: TaskDependency[];
}

export interface DependencyResult {
  taskId: string;
  state: DependencyState;
  missingDependencies: string[];
}

export interface RetryPolicy {
  strategy: RetryStrategy;
  maxRetries: number;
  initialDelayMs: number;
  backoffFactor?: number; // multiplier for exponential backoff
}

export interface RetryHistory {
  taskId: string;
  retryCount: number;
  lastRetryAt: Date;
  nextRetryAt: Date;
  errors: string[];
}

export interface SchedulerMetrics {
  activeJobsCount: number;
  waitingJobsCount: number;
  failedJobsCount: number;
  queueSize: number;
  workerUtilizationPercent: number;
  averageExecutionTimeMs: number;
}

export interface SchedulerReport {
  timestamp: Date;
  state: SchedulerState;
  statistics: SchedulerStatistics;
  health: SchedulerHealth;
}

export interface SchedulerEvent {
  id: string;
  type: SchedulerEventType;
  taskId?: string;
  payload?: any;
  timestamp: Date;
}

export interface ExecutionTimeline {
  taskId: string;
  history: TaskHistory[];
}

export interface SchedulerHealth {
  healthy: boolean;
  databaseConnected?: boolean;
  activeWorkers: number;
  freeWorkers: number;
  lastCheckTime: Date;
}
