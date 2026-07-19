import { SchedulerState } from "./SchedulerState";
import { TaskState } from "./TaskState";
import { ScheduleType } from "./ScheduleType";
import { TriggerType } from "./TriggerType";
import { RetryStrategy } from "./RetryStrategy";
import { QueuePriority } from "./QueuePriority";
import { DependencyState } from "./DependencyState";
import { SchedulerEventType } from "./SchedulerEventType";
import {
  Scheduler,
  SchedulerRequest,
  SchedulerResponse,
  SchedulerConfiguration,
  SchedulerStatistics,
  SchedulerSnapshot,
  ScheduledTask,
  TaskExecution,
  TaskQueue,
  QueueItem,
  TaskHistory,
  ScheduleRule,
  CronSchedule,
  IntervalSchedule,
  TimeWindow,
  TaskDependency,
  DependencyGraph,
  DependencyResult,
  RetryPolicy,
  RetryHistory,
  SchedulerMetrics,
  SchedulerReport,
  SchedulerEvent,
  ExecutionTimeline,
  SchedulerHealth
} from "./models";

export interface ISchedulerEngine {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  
  getState(): SchedulerState;
  getTaskManager(): ITaskManager;
  getQueueManager(): IQueueManager;
  getTriggerManager(): ITriggerManager;
  getDependencyManager(): IDependencyManager;
  getRetryManager(): IRetryManager;
  getCronManager(): ICronManager;
  getExecutionManager(): IExecutionManager;
  getMonitor(): ISchedulerMonitor;
  getReporter(): ISchedulerReporter;
  
  getContext(): any;
  getConfig(): SchedulerConfiguration;
  
  on(event: string, handler: (payload: any) => void): void;
  off(event: string, handler: (payload: any) => void): void;
  emit(event: string, payload?: any): void;
}

export interface ITaskManager {
  createTask(task: Partial<ScheduledTask>): Promise<ScheduledTask>;
  deleteTask(taskId: string): Promise<void>;
  updateTask(task: ScheduledTask): Promise<void>;
  pauseTask(taskId: string): Promise<void>;
  resumeTask(taskId: string): Promise<void>;
  cancelTask(taskId: string): Promise<void>;
  cloneTask(taskId: string): Promise<ScheduledTask>;
  archiveTask(taskId: string): Promise<void>;
  getTask(taskId: string): Promise<ScheduledTask>;
  listTasks(): ScheduledTask[];
}

export interface IQueueManager {
  enqueue(task: ScheduledTask): Promise<void>;
  dequeue(): Promise<QueueItem | undefined>;
  getQueue(): TaskQueue;
  clearQueue(): Promise<void>;
  getQueueItems(): QueueItem[];
}

export interface ITriggerManager {
  registerTrigger(taskId: string, rule: ScheduleRule): Promise<void>;
  evaluateTriggers(now: Date): Promise<void>;
}

export interface IDependencyManager {
  addDependency(taskId: string, dependsOnTaskId: string): void;
  validateGraph(): void;
  evaluateDependencies(taskId: string): DependencyState;
  getDependencies(taskId: string): string[];
}

export interface IRetryManager {
  shouldRetry(task: ScheduledTask, error: Error): boolean;
  calculateNextDelay(task: ScheduledTask): number;
  recordRetry(taskId: string, error: Error): void;
  getRetryHistory(taskId: string): RetryHistory | undefined;
}

export interface ICronManager {
  parseCron(cronExpr: string): CronSchedule;
  isCronDue(cron: CronSchedule, now: Date): boolean;
}

export interface IExecutionManager {
  executeTask(task: ScheduledTask): Promise<TaskExecution>;
  getActiveExecutions(): TaskExecution[];
}

export interface ISchedulerMonitor {
  getActiveJobs(): TaskExecution[];
  getWaitingJobs(): ScheduledTask[];
  getFailedJobs(): TaskHistory[];
  getMetrics(): SchedulerMetrics;
}

export interface ISchedulerReporter {
  generateReport(): SchedulerReport;
  getSchedulerSnapshot(): SchedulerSnapshot;
}
