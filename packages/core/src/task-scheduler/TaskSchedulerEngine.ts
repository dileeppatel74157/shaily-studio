import {
  ITaskSchedulerEngine,
  ITaskManager,
  IQueueManager,
  ITriggerManager,
  IDependencyManager,
  IRetryManager,
  ICronManager,
  IExecutionManager,
  IResumeManager,
  IMonitoringManager,
  ISchedulerMonitor,
  ISchedulerReporter
} from "./interfaces";
import { SchedulerState } from "./SchedulerState";
import { TaskState } from "./TaskState";
import { TaskPriority } from "./TaskPriority";
import { TriggerType } from "./TriggerType";
import { ScheduleType } from "./ScheduleType";
import { RetryPolicy } from "./RetryPolicy";
import { DependencyState } from "./DependencyState";
import { ExecutionWindow } from "./ExecutionWindow";
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
  RetryPolicyConfig,
  RetryHistory,
  SchedulerMetrics,
  SchedulerReport,
  SchedulerEvent,
  ExecutionTimeline,
  SchedulerHealth
} from "./models";
import {
  TaskSchedulerException,
  TaskNotFoundException,
  TriggerException,
  CronParseException,
  TaskSchedulerValidationException,
  InvalidTaskSchedulerStateException,
  deepFreeze
} from "./types";
import { TaskSchedulerValidator } from "./TaskSchedulerValidator";

export class TaskSchedulerEngine implements ITaskSchedulerEngine {
  private _state = SchedulerState.CREATED;
  private readonly _eventHandlers = new Map<string, Set<(event: any) => void>>();
  private _checkIntervalTimer?: NodeJS.Timeout;

  // Sub-components
  private readonly _taskManager: TaskManagerImpl;
  private readonly _queueManager: QueueManagerImpl;
  private readonly _triggerManager: TriggerManagerImpl;
  private readonly _dependencyManager: DependencyManagerImpl;
  private readonly _retryManager: RetryManagerImpl;
  private readonly _cronManager: CronManagerImpl;
  private readonly _executionManager: ExecutionManagerImpl;
  private readonly _resumeManager: ResumeManagerImpl;
  private readonly _monitoringManager: MonitoringManagerImpl;
  private readonly _reporter: SchedulerReporterImpl;

  private _bootTime = Date.now();
  private _tasksExecuted = 0;
  private _tasksCompleted = 0;
  private _tasksFailed = 0;
  private _tasksRetried = 0;
  private _tasksSkipped = 0;
  private _totalExecutionTimeMs = 0;

  constructor(
    private readonly _context: any,
    private readonly _config: SchedulerConfiguration
  ) {
    this._taskManager = new TaskManagerImpl(this);
    this._queueManager = new QueueManagerImpl(this);
    this._triggerManager = new TriggerManagerImpl(this);
    this._dependencyManager = new DependencyManagerImpl(this);
    this._retryManager = new RetryManagerImpl(this);
    this._cronManager = new CronManagerImpl(this);
    this._executionManager = new ExecutionManagerImpl(this);
    this._resumeManager = new ResumeManagerImpl(this);
    this._monitoringManager = new MonitoringManagerImpl(this);
    this._reporter = new SchedulerReporterImpl(this);
  }

  // --- ITaskSchedulerEngine implementation ---

  public async initialize(): Promise<void> {
    if (this._state === SchedulerState.STOPPED) {
      this._state = SchedulerState.CREATED;
    }
    if (this._state !== SchedulerState.CREATED) {
      throw new InvalidTaskSchedulerStateException("initialize", this._state);
    }
    
    this._state = SchedulerState.INITIALIZING;
    await this.logToMemory("scheduler", "initialize_start", { timestamp: new Date() });

    try {
      // Auto Resume: restore unfinished queue from memory store
      if (this._config.persistenceEnabled) {
        const restored = await this._resumeManager.recoverUnfinishedTasks();
        for (const task of restored) {
          await this._taskManager.restoreTask(task);
          if (task.state === TaskState.QUEUED || task.state === TaskState.RUNNING) {
            await this._queueManager.enqueue(task);
            this.emit("TaskResumed", { taskId: task.id });
          }
        }
      }

      this._state = SchedulerState.STOPPED;
      await this.logToMemory("scheduler", "initialize_success", { timestamp: new Date() });
    } catch (err: any) {
      this._state = SchedulerState.FAILED;
      await this.logToMemory("scheduler", "initialize_failed", { timestamp: new Date(), error: err.message });
      throw new TaskSchedulerException(`Scheduler initialization failed: ${err.message}`);
    }
  }

  public async start(): Promise<void> {
    if (this._state !== SchedulerState.STOPPED) {
      throw new InvalidTaskSchedulerStateException("start", this._state);
    }

    this._state = SchedulerState.RUNNING;
    this.emit("SchedulerStarted", { timestamp: new Date() });
    await this.logToMemory("scheduler", "start_success", { timestamp: new Date() });

    // Startup Background check loop
    this._checkIntervalTimer = setInterval(() => {
      this._triggerManager.evaluateTriggers(new Date()).catch(() => {});
      this.processQueue().catch(() => {});
    }, this._config.checkIntervalMs);
  }

  public async stop(): Promise<void> {
    if (this._state !== SchedulerState.RUNNING && this._state !== SchedulerState.PAUSED) {
      throw new InvalidTaskSchedulerStateException("stop", this._state);
    }

    this._state = SchedulerState.STOPPING;
    if (this._checkIntervalTimer) {
      clearInterval(this._checkIntervalTimer);
      this._checkIntervalTimer = undefined;
    }

    // Persist unfinished queue before stopping
    if (this._config.persistenceEnabled) {
      const unfinished = this._taskManager.listTasks().filter(t => t.state === TaskState.QUEUED || t.state === TaskState.RUNNING);
      await this.logToMemory("scheduler", "unfinished_tasks", unfinished);
    }

    this._state = SchedulerState.STOPPED;
    this.emit("SchedulerStopped", { timestamp: new Date() });
    await this.logToMemory("scheduler", "stop_success", { timestamp: new Date() });
  }

  public getState(): SchedulerState { return this._state; }
  public getTaskManager(): ITaskManager { return this._taskManager; }
  public getQueueManager(): IQueueManager { return this._queueManager; }
  public getTriggerManager(): ITriggerManager { return this._triggerManager; }
  public getDependencyManager(): IDependencyManager { return this._dependencyManager; }
  public getRetryManager(): IRetryManager { return this._retryManager; }
  public getCronManager(): ICronManager { return this._cronManager; }
  public getExecutionManager(): IExecutionManager { return this._executionManager; }
  public getResumeManager(): IResumeManager { return this._resumeManager; }
  public getMonitoringManager(): IMonitoringManager { return this._monitoringManager; }
  
  public getMonitor(): ISchedulerMonitor { return this._monitoringManager; }
  public getReporter(): ISchedulerReporter { return this._reporter; }
  public getContext(): any { return this._context; }
  public getConfig(): SchedulerConfiguration { return this._config; }

  public getUptimeMs(): number {
    return Date.now() - this._bootTime;
  }

  public getAverageResponseTimeMs(): number {
    return this._tasksExecuted > 0 ? this._totalExecutionTimeMs / this._tasksExecuted : 0;
  }

  public on(event: string, handler: (payload: any) => void): void {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event)!.add(handler);
  }

  public off(event: string, handler: (payload: any) => void): void {
    if (this._eventHandlers.has(event)) {
      this._eventHandlers.get(event)!.delete(handler);
    }
  }

  public emit(event: string, payload?: any): void {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      for (const h of handlers) {
        try {
          h(payload);
        } catch {
          // suppress
        }
      }
    }
    this.logToMemory("triggers", `event-${Date.now()}`, { event, payload }).catch(() => {});
  }

  // --- Helper Methods ---

  public async logToMemory(namespace: string, key: string, value: any): Promise<void> {
    if (this._context.memoryStore && typeof this._context.memoryStore.set === "function") {
      try {
        await this._context.memoryStore.set(namespace, key, value);
      } catch {
        // suppress
      }
    }
  }

  public async getFromMemory<T>(namespace: string, key: string): Promise<T | undefined> {
    if (this._context.memoryStore && typeof this._context.memoryStore.get === "function") {
      try {
        return await this._context.memoryStore.get(namespace, key) as T;
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  public async processQueue(): Promise<void> {
    if (this._state !== SchedulerState.RUNNING) return;

    const activeExecs = this._executionManager.getActiveExecutions().length;
    const limit = this._config.concurrentLimit;

    if (activeExecs >= limit) return;

    const next = await this._queueManager.dequeue();
    if (!next) return;

    const task = await this._taskManager.getTask(next.taskId);
    
    // Check dependencies
    const depState = this._dependencyManager.evaluateDependencies(task.id);
    if (depState === DependencyState.WAITING || depState === DependencyState.BLOCKED) {
      // Re-enqueue/hold
      await this._queueManager.enqueue(task);
      return;
    }

    if (depState === DependencyState.FAILED) {
      task.state = TaskState.SKIPPED;
      task.lastError = "Skipped because dependencies failed.";
      this.emit("TaskSkipped", { taskId: task.id });
      this._tasksSkipped++;
      await this._taskManager.updateTask(task);
      return;
    }

    // Execute
    const startTime = Date.now();
    this._tasksExecuted++;
    try {
      this.emit("TaskStarted", { taskId: task.id });
      const exec = await this._executionManager.executeTask(task);
      
      this._tasksCompleted++;
      this._totalExecutionTimeMs += (Date.now() - startTime);
      this.emit("TaskCompleted", { taskId: task.id, durationMs: Date.now() - startTime });
    } catch (err: any) {
      this._tasksFailed++;
      this._totalExecutionTimeMs += (Date.now() - startTime);
      task.lastError = err.message;
      this.emit("TaskFailed", { taskId: task.id, error: err.message });

      // Retry Check
      if (this._retryManager.shouldRetry(task, err)) {
        this._retryManager.recordRetry(task.id, err);
        const delay = this._retryManager.calculateNextDelay(task);
        task.state = TaskState.PENDING;
        task.nextRunAt = new Date(Date.now() + delay);
        this._tasksRetried++;
        this.emit("TaskRetried", { taskId: task.id, attempt: task.retryPolicy.maxRetries - delay });
      } else {
        task.state = TaskState.FAILED;
      }
      await this._taskManager.updateTask(task);
    }
  }
}

// ─── Task Manager Implementation ───────────────────────────────────────────────

class TaskManagerImpl implements ITaskManager {
  public readonly tasks = new Map<string, ScheduledTask>();

  constructor(private readonly engine: TaskSchedulerEngine) {}

  public async createTask(task: Partial<ScheduledTask>): Promise<ScheduledTask> {
    const id = task.id || `task-${Date.now()}-${Math.floor(Math.random() * 100)}`;
    TaskSchedulerValidator.validateTaskId(id);

    if (this.tasks.has(id)) {
      throw new TaskSchedulerValidationException(`Task with ID "${id}" already exists.`);
    }

    const rule: ScheduleRule = task.schedule || { type: ScheduleType.ONCE, triggerType: TriggerType.MANUAL };
    TaskSchedulerValidator.validateScheduleRule(rule);

    const policy: RetryPolicyConfig = task.retryPolicy || { strategy: RetryPolicy.NONE, maxRetries: 0, initialDelayMs: 0 };
    TaskSchedulerValidator.validateRetryPolicy(policy);

    const newTask: ScheduledTask = {
      id,
      name: task.name || "Default Scheduled Task",
      state: TaskState.PENDING,
      priority: task.priority || TaskPriority.NORMAL,
      schedule: rule,
      retryPolicy: policy,
      dependencies: task.dependencies || [],
      targetPipelineId: task.targetPipelineId,
      parameters: task.parameters || {},
      nextRunAt: task.nextRunAt,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    TaskSchedulerValidator.validateScheduledTask(newTask);

    const tempTasks = [...Array.from(this.tasks.values()), newTask];
    TaskSchedulerValidator.validateCircularDependencies(tempTasks);

    this.tasks.set(id, newTask);
    this.engine.emit("TaskCreated", { taskId: id });
    this.engine.emit("TaskScheduled", { taskId: id });
    await this.engine.logToMemory("tasks", `task-${id}`, newTask);
    return newTask;
  }

  public async restoreTask(task: ScheduledTask): Promise<void> {
    this.tasks.set(task.id, task);
  }

  public async deleteTask(taskId: string): Promise<void> {
    TaskSchedulerValidator.validateTaskId(taskId);
    if (!this.tasks.has(taskId)) {
      throw new TaskNotFoundException(taskId);
    }
    this.tasks.delete(taskId);
  }

  public async updateTask(task: ScheduledTask): Promise<void> {
    TaskSchedulerValidator.validateScheduledTask(task);
    if (!this.tasks.has(task.id)) {
      throw new TaskNotFoundException(task.id);
    }
    task.updatedAt = new Date();
    this.tasks.set(task.id, task);
    await this.engine.logToMemory("tasks", `task-${task.id}`, task);
  }

  public async pauseTask(taskId: string): Promise<void> {
    const task = await this.getTask(taskId);
    task.state = TaskState.WAITING;
    await this.updateTask(task);
  }

  public async resumeTask(taskId: string): Promise<void> {
    const task = await this.getTask(taskId);
    task.state = TaskState.PENDING;
    await this.updateTask(task);
  }

  public async cancelTask(taskId: string): Promise<void> {
    const task = await this.getTask(taskId);
    task.state = TaskState.CANCELLED;
    this.engine.emit("TaskCancelled", { taskId });
    await this.updateTask(task);
  }

  public async cloneTask(taskId: string): Promise<ScheduledTask> {
    const orig = await this.getTask(taskId);
    return this.createTask({
      name: `copy-${orig.name}`,
      priority: orig.priority,
      schedule: orig.schedule,
      retryPolicy: orig.retryPolicy,
      dependencies: orig.dependencies,
      targetPipelineId: orig.targetPipelineId,
      parameters: orig.parameters
    });
  }

  public async archiveTask(taskId: string): Promise<void> {
    const task = await this.getTask(taskId);
    task.state = TaskState.SKIPPED;
    await this.updateTask(task);
  }

  public async getTask(taskId: string): Promise<ScheduledTask> {
    TaskSchedulerValidator.validateTaskId(taskId);
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new TaskNotFoundException(taskId);
    }
    return task;
  }

  public listTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }
}

// ─── Queue Manager Implementation ──────────────────────────────────────────────

class QueueManagerImpl implements IQueueManager {
  private readonly queue: QueueItem[] = [];

  constructor(private readonly engine: TaskSchedulerEngine) {}

  public async enqueue(task: ScheduledTask): Promise<void> {
    TaskSchedulerValidator.validateTaskId(task.id);
    
    if (this.queue.some(q => q.taskId === task.id)) return;

    this.queue.push({
      taskId: task.id,
      priority: task.priority,
      queuedAt: new Date()
    });

    // Sort priority
    const priorityWeights: Record<TaskPriority, number> = {
      [TaskPriority.CRITICAL]: 5,
      [TaskPriority.HIGH]: 4,
      [TaskPriority.NORMAL]: 3,
      [TaskPriority.LOW]: 2,
      [TaskPriority.BACKGROUND]: 1
    };

    this.queue.sort((a, b) => {
      const wa = priorityWeights[a.priority];
      const wb = priorityWeights[b.priority];
      if (wa !== wb) return wb - wa;
      return a.queuedAt.getTime() - b.queuedAt.getTime();
    });

    TaskSchedulerValidator.validateQueueIntegrity(this.queue, this.engine.getConfig().maxQueueSize);
    
    task.state = TaskState.QUEUED;
    await this.engine.getTaskManager().updateTask(task);
    
    this.engine.emit("TaskQueued", { taskId: task.id });
    this.engine.emit("QueueUpdated", { queueSize: this.queue.length });
    await this.engine.logToMemory("queue", "current_queue", this.queue);
  }

  public async dequeue(): Promise<QueueItem | undefined> {
    const item = this.queue.shift();
    if (item) {
      this.engine.emit("QueueUpdated", { queueSize: this.queue.length });
      await this.engine.logToMemory("queue", "current_queue", this.queue);
    }
    return item;
  }

  public getQueue(): TaskQueue {
    return {
      items: this.queue,
      maxSize: this.engine.getConfig().maxQueueSize || 1000
    };
  }

  public async clearQueue(): Promise<void> {
    this.queue.length = 0;
  }

  public getQueueItems(): QueueItem[] {
    return this.queue;
  }
}

// ─── Trigger Manager Implementation ────────────────────────────────────────────

class TriggerManagerImpl implements ITriggerManager {
  constructor(private readonly engine: TaskSchedulerEngine) {}

  public async registerTrigger(taskId: string, rule: ScheduleRule): Promise<void> {}

  public async evaluateTriggers(now: Date): Promise<void> {
    const tasks = this.engine.getTaskManager().listTasks();
    const cronManager = this.engine.getCronManager();

    for (const task of tasks) {
      if (task.state !== TaskState.PENDING) continue;

      let triggerDue = false;
      const rule = task.schedule;
      if (rule.type === ScheduleType.INTERVAL && rule.intervalMs) {
        const lastRun = task.lastRunAt ? task.lastRunAt.getTime() : task.createdAt.getTime();
        if (now.getTime() - lastRun >= rule.intervalMs) {
          triggerDue = true;
        }
      } else if (rule.type === ScheduleType.CRON && rule.cronExpression) {
        try {
          const cron = cronManager.parseCron(rule.cronExpression);
          if (cronManager.isCronDue(cron, now)) {
            triggerDue = true;
          }
        } catch {
          // ignore
        }
      } else if (rule.type === ScheduleType.DAILY) {
        const lastRun = task.lastRunAt ? task.lastRunAt.getTime() : 0;
        if (now.getTime() - lastRun >= 24 * 60 * 60 * 1000) {
          triggerDue = true;
        }
      } else if (rule.type === ScheduleType.WEEKLY) {
        const lastRun = task.lastRunAt ? task.lastRunAt.getTime() : 0;
        if (now.getTime() - lastRun >= 7 * 24 * 60 * 60 * 1000) {
          triggerDue = true;
        }
      } else if (task.nextRunAt && now >= task.nextRunAt) {
        triggerDue = true;
      }

      if (triggerDue) {
        this.engine.emit("TriggerFired", { taskId: task.id, triggerType: rule.triggerType });
        await this.engine.getQueueManager().enqueue(task);
      }
    }
  }
}

// ─── Dependency Manager Implementation ──────────────────────────────────────────

class DependencyManagerImpl implements IDependencyManager {
  constructor(private readonly engine: TaskSchedulerEngine) {}

  public addDependency(taskId: string, dependsOnTaskId: string): void {}

  public validateGraph(): void {
    const tasks = this.engine.getTaskManager().listTasks();
    TaskSchedulerValidator.validateCircularDependencies(tasks);
  }

  public evaluateDependencies(taskId: string): DependencyState {
    const manager = this.engine.getTaskManager();
    let task: ScheduledTask;
    try {
      task = Array.from((manager as any).tasks.values()).find((t: any) => t.id === taskId) as ScheduledTask;
    } catch {
      return DependencyState.FAILED;
    }

    if (!task || task.dependencies.length === 0) return DependencyState.READY;

    let hasPending = false;
    for (const depId of task.dependencies) {
      let dep: ScheduledTask;
      try {
        dep = Array.from((manager as any).tasks.values()).find((t: any) => t.id === depId) as ScheduledTask;
      } catch {
        return DependencyState.FAILED;
      }
      
      if (!dep) return DependencyState.FAILED;

      if (dep.state === TaskState.FAILED || dep.state === TaskState.CANCELLED) {
        return DependencyState.FAILED;
      }
      if (dep.state !== TaskState.COMPLETED) {
        hasPending = true;
      }
    }

    if (!hasPending) {
      this.engine.emit("DependencyResolved", { taskId });
    }

    return hasPending ? DependencyState.WAITING : DependencyState.READY;
  }

  public getDependencies(taskId: string): string[] {
    const task = this.engine.getTaskManager().listTasks().find(t => t.id === taskId);
    return task ? task.dependencies : [];
  }
}

// ─── Retry Manager Implementation ──────────────────────────────────────────────

class RetryManagerImpl implements IRetryManager {
  private readonly history = new Map<string, RetryHistory>();

  constructor(private readonly engine: TaskSchedulerEngine) {}

  public shouldRetry(task: ScheduledTask, error: Error): boolean {
    if (task.retryPolicy.strategy === RetryPolicy.NONE) return false;

    const hist = this.history.get(task.id);
    const attempt = hist ? hist.retryCount : 0;
    return attempt < task.retryPolicy.maxRetries;
  }

  public calculateNextDelay(task: ScheduledTask): number {
    const hist = this.history.get(task.id);
    const attempt = hist ? hist.retryCount : 1;

    const policy = task.retryPolicy;
    if (policy.strategy === RetryPolicy.FIXED_DELAY) {
      return policy.initialDelayMs;
    }
    if (policy.strategy === RetryPolicy.EXPONENTIAL_BACKOFF) {
      const factor = policy.backoffFactor || 2;
      return policy.initialDelayMs * Math.pow(factor, attempt - 1);
    }
    return policy.initialDelayMs;
  }

  public recordRetry(taskId: string, error: Error): void {
    if (!this.history.has(taskId)) {
      this.history.set(taskId, {
        taskId,
        retryCount: 0,
        lastRetryAt: new Date(),
        nextRetryAt: new Date(),
        errors: []
      });
    }
    const hist = this.history.get(taskId)!;
    hist.retryCount++;
    hist.lastRetryAt = new Date();
    hist.errors.push(error.message);
  }

  public getRetryHistory(taskId: string): RetryHistory | undefined {
    return this.history.get(taskId);
  }
}

// ─── Cron Manager Implementation ───────────────────────────────────────────────

class CronManagerImpl implements ICronManager {
  constructor(private readonly engine: TaskSchedulerEngine) {}

  public parseCron(cronExpr: string): CronSchedule {
    TaskSchedulerValidator.validateCronExpression(cronExpr);
    const fields = cronExpr.trim().split(/\s+/);
    
    const parseField = (field: string, min: number, max: number): number[] => {
      if (field === "*") {
        const all: number[] = [];
        for (let i = min; i <= max; i++) all.push(i);
        return all;
      }
      const vals: number[] = [];
      const parts = field.split(",");
      for (const part of parts) {
        if (part.startsWith("*/")) {
          const step = parseInt(part.substring(2));
          for (let i = min; i <= max; i += step) vals.push(i);
        } else if (part.includes("-")) {
          const [start, end] = part.split("-").map(Number);
          for (let i = start; i <= end; i++) vals.push(i);
        } else {
          vals.push(Number(part));
        }
      }
      return Array.from(new Set(vals)).sort((a, b) => a - b);
    };

    return {
      expression: cronExpr,
      minutes: parseField(fields[0], 0, 59),
      hours: parseField(fields[1], 0, 23),
      daysOfMonth: parseField(fields[2], 1, 31),
      months: parseField(fields[3], 1, 12),
      daysOfWeek: parseField(fields[4], 0, 6)
    };
  }

  public isCronDue(cron: CronSchedule, now: Date): boolean {
    return (
      cron.minutes.includes(now.getMinutes()) &&
      cron.hours.includes(now.getHours()) &&
      cron.daysOfWeek.includes(now.getDay())
    );
  }
}

// ─── Execution Manager Implementation ──────────────────────────────────────────

class ExecutionManagerImpl implements IExecutionManager {
  private readonly activeExecutions = new Map<string, TaskExecution>();

  constructor(private readonly engine: TaskSchedulerEngine) {}

  public async executeTask(task: ScheduledTask): Promise<TaskExecution> {
    task.state = TaskState.RUNNING;
    task.lastRunAt = new Date();
    await this.engine.getTaskManager().updateTask(task);

    const exec: TaskExecution = {
      id: `exec-${task.id}-${Date.now()}`,
      taskId: task.id,
      workerId: `worker-${Math.floor(Math.random() * 5)}`,
      state: TaskState.RUNNING,
      startedAt: new Date()
    };

    this.activeExecutions.set(task.id, exec);
    await this.engine.logToMemory("executions", `exec-${task.id}`, exec);

    try {
      if (task.targetPipelineId) {
        // pipeline run simulation
        await this.engine.logToMemory("pipeline-runs", `pipeline-${task.targetPipelineId}`, { timestamp: new Date() });
      }

      await this.engine.getResumeManager().checkpointTask(task);

      // Simulate execution delay
      await new Promise(resolve => setTimeout(resolve, 5));

      task.state = TaskState.COMPLETED;
      exec.state = TaskState.COMPLETED;
      exec.completedAt = new Date();
      await this.engine.getTaskManager().updateTask(task);
      this.activeExecutions.delete(task.id);
      
      return exec;
    } catch (err: any) {
      exec.state = TaskState.FAILED;
      exec.error = err.message;
      this.activeExecutions.delete(task.id);
      throw err;
    }
  }

  public getActiveExecutions(): TaskExecution[] {
    return Array.from(this.activeExecutions.values());
  }
}

// ─── Resume Manager Implementation ─────────────────────────────────────────────

class ResumeManagerImpl implements IResumeManager {
  constructor(private readonly engine: TaskSchedulerEngine) {}

  public async checkpointTask(task: ScheduledTask): Promise<void> {
    await this.engine.logToMemory("checkpoints", `checkpoint-${task.id}`, {
      taskId: task.id,
      state: task.state,
      timestamp: new Date()
    });
  }

  public async recoverUnfinishedTasks(): Promise<ScheduledTask[]> {
    const unfinished = await this.engine.getFromMemory<ScheduledTask[]>("scheduler", "unfinished_tasks");
    return unfinished || [];
  }
}

// ─── Monitoring Manager Implementation ─────────────────────────────────────────

class MonitoringManagerImpl implements IMonitoringManager, ISchedulerMonitor {
  constructor(private readonly engine: TaskSchedulerEngine) {}

  public getActiveJobs(): TaskExecution[] {
    return this.engine.getExecutionManager().getActiveExecutions();
  }

  public getWaitingJobs(): ScheduledTask[] {
    return this.engine.getTaskManager().listTasks().filter(t => t.state === TaskState.QUEUED);
  }

  public getFailedJobs(): TaskHistory[] {
    return [];
  }

  public getMetrics(): SchedulerMetrics {
    const queue = this.engine.getQueueManager().getQueueItems();
    const tasks = this.engine.getTaskManager().listTasks();
    
    return {
      activeJobsCount: this.getActiveJobs().length,
      waitingJobsCount: this.getWaitingJobs().length,
      failedJobsCount: tasks.filter(t => t.state === TaskState.FAILED).length,
      queueSize: queue.length,
      workerUtilizationPercent: this.getActiveJobs().length > 0 ? 80 : 0,
      averageExecutionTimeMs: this.engine.getAverageResponseTimeMs()
    };
  }

  public async getTimeline(taskId: string): Promise<ExecutionTimeline> {
    return { taskId, history: [] };
  }
}

// ─── Scheduler Reporter Implementation ─────────────────────────────────────────

class SchedulerReporterImpl implements ISchedulerReporter {
  constructor(private readonly engine: TaskSchedulerEngine) {}

  public generateReport(): SchedulerReport {
    return {
      timestamp: new Date(),
      state: this.engine.getState(),
      statistics: {
        uptimeMs: this.engine.getUptimeMs(),
        tasksExecuted: (this.engine as any)._tasksExecuted,
        tasksCompleted: (this.engine as any)._tasksCompleted,
        tasksFailed: (this.engine as any)._tasksFailed,
        tasksRetried: (this.engine as any)._tasksRetried,
        tasksSkipped: (this.engine as any)._tasksSkipped,
        averageExecutionTimeMs: this.engine.getAverageResponseTimeMs()
      },
      health: {
        healthy: true,
        activeWorkers: this.engine.getExecutionManager().getActiveExecutions().length,
        freeWorkers: this.engine.getConfig().concurrentLimit - this.engine.getExecutionManager().getActiveExecutions().length,
        lastCheckTime: new Date()
      }
    };
  }

  public getSchedulerSnapshot(): SchedulerSnapshot {
    const tasks = this.engine.getTaskManager().listTasks();
    const queue = this.engine.getQueueManager().getQueueItems();
    
    const snap: SchedulerSnapshot = {
      timestamp: new Date(),
      state: this.engine.getState(),
      tasks,
      queue,
      metrics: this.engine.getMonitor().getMetrics()
    };

    const cloned = JSON.parse(JSON.stringify(snap));
    cloned.timestamp = new Date(cloned.timestamp);
    for (const t of cloned.tasks) {
      t.createdAt = new Date(t.createdAt);
      t.updatedAt = new Date(t.updatedAt);
      if (t.nextRunAt) t.nextRunAt = new Date(t.nextRunAt);
      if (t.lastRunAt) t.lastRunAt = new Date(t.lastRunAt);
    }
    for (const q of cloned.queue) {
      q.queuedAt = new Date(q.queuedAt);
    }

    const frozen = deepFreeze(cloned);
    TaskSchedulerValidator.validateSnapshotImmutability(frozen);
    return frozen;
  }
}
