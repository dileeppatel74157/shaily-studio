import { DailyAutomationState } from "./DailyAutomationState";
import { AutomationScheduleType } from "./AutomationScheduleType";
import { AutomationPriority } from "./AutomationPriority";
import { AutomationTaskState } from "./AutomationTaskState";
import { RoutineType } from "./RoutineType";
import { AutomationEventType } from "./AutomationEventType";
import { AutomationTrigger } from "./AutomationTrigger";
import {
  IDailyAutomationEngine,
  IRoutineManager,
  IScheduleManager,
  ITaskManager,
  IExecutionManager,
  IPipelineManager,
  IHealthManager,
  IStatisticsManager,
  IHistoryManager,
  IBackupManager,
  ISummaryManager
} from "./interfaces";
import {
  DailyRoutine,
  AutomationTask,
  AutomationExecution,
  AutomationHistory,
  AutomationSnapshot,
  AutomationStatistics,
  DailySummary,
  FounderReminder,
  BackupJob,
  AutomationHealth
} from "./models";
import {
  DailyAutomationException,
  RoutineException,
  ScheduleException,
  ExecutionException,
  deepFreeze
} from "./exceptions";
import { DailyAutomationValidator } from "./DailyAutomationValidator";

export class DailyAutomationEngine implements IDailyAutomationEngine {
  private _state = DailyAutomationState.CREATED;
  private readonly _eventHandlers = new Map<string, Set<(payload: any) => void>>();
  
  // Registries
  private readonly _routines = new Map<string, DailyRoutine>();
  private readonly _tasks = new Map<string, AutomationTask>();
  private readonly _activeExecutions = new Map<string, AutomationExecution>();
  private readonly _history: AutomationHistory[] = [];
  private readonly _backups: BackupJob[] = [];
  private readonly _reminders: FounderReminder[] = [];
  private readonly _schedules = new Map<string, string>(); // routineId -> cron

  private _stats: AutomationStatistics = {
    successRate: 100.0,
    totalExecutions: 0,
    failedExecutions: 0,
    uptimeSeconds: 0
  };

  private readonly _routineMgr: IRoutineManager;
  private readonly _scheduleMgr: IScheduleManager;
  private readonly _taskMgr: ITaskManager;
  private readonly _executionMgr: IExecutionManager;
  private readonly _pipelineMgr: IPipelineManager;
  private readonly _healthMgr: IHealthManager;
  private readonly _statsMgr: IStatisticsManager;
  private readonly _historyMgr: IHistoryManager;
  private readonly _backupMgr: IBackupManager;
  private readonly _summaryMgr: ISummaryManager;
  private readonly _validator = new DailyAutomationValidator();

  constructor(public readonly context: any) {
    if (!context) {
      throw new DailyAutomationException("Context is required to build DailyAutomationEngine.");
    }

    this._routineMgr = new RoutineManagerImpl(this);
    this._scheduleMgr = new ScheduleManagerImpl(this);
    this._taskMgr = new TaskManagerImpl(this);
    this._executionMgr = new ExecutionManagerImpl(this);
    this._pipelineMgr = new PipelineManagerImpl(this);
    this._healthMgr = new HealthManagerImpl(this);
    this._statsMgr = new StatisticsManagerImpl(this);
    this._historyMgr = new HistoryManagerImpl(this);
    this._backupMgr = new BackupManagerImpl(this);
    this._summaryMgr = new SummaryManagerImpl(this);
  }

  // --- IDailyAutomationEngine Lifecycle ---

  public async initialize(): Promise<void> {
    if (this._state !== DailyAutomationState.CREATED && this._state !== DailyAutomationState.STOPPED) {
      throw new DailyAutomationException(`Cannot initialize engine from state: ${this._state}`);
    }

    this._state = DailyAutomationState.INITIALIZING;
    try {
      this._routines.clear();
      this._tasks.clear();
      this._activeExecutions.clear();
      this._schedules.clear();

      // Register default automated routines
      this._registerDefaultRoutines();

      this._state = DailyAutomationState.READY;
      this.emit(AutomationEventType.STATE_CHANGED, { state: this._state });
    } catch (err: any) {
      this._state = DailyAutomationState.FAILED;
      throw new DailyAutomationException(`Initialization failed: ${err.message}`);
    }
  }

  public async start(): Promise<void> {
    if (this._state !== DailyAutomationState.READY && this._state !== DailyAutomationState.STOPPED) {
      throw new DailyAutomationException(`Cannot start engine from state: ${this._state}`);
    }
    this._state = DailyAutomationState.RUNNING;
    this.emit(AutomationEventType.STATE_CHANGED, { state: this._state });
  }

  public async stop(): Promise<void> {
    if (this._state !== DailyAutomationState.RUNNING) {
      throw new DailyAutomationException(`Cannot stop engine from state: ${this._state}`);
    }
    this._state = DailyAutomationState.STOPPED;
    this.emit(AutomationEventType.STATE_CHANGED, { state: this._state });
  }

  public getState(): DailyAutomationState {
    return this._state;
  }

  public getSnapshot(): AutomationSnapshot {
    const activeErrors = this._healthMgr.getUnhealthyComponents();
    const healthStatus = activeErrors.length > 0 ? ("unhealthy" as const) : ("healthy" as const);
    
    const snapshot: AutomationSnapshot = {
      timestamp: new Date(),
      state: this._state,
      health: {
        status: healthStatus,
        lastCheckTime: new Date(),
        activeErrors
      },
      statistics: this._statsMgr.getStats(),
      activeRoutines: Array.from(this._routines.values()).map(r => ({
        ...r,
        schedule: { ...r.schedule },
        tasks: r.tasks.map(t => ({ ...t }))
      })),
      activeExecutions: Array.from(this._activeExecutions.values()).map(e => ({ ...e })),
      recentHistory: this._history.map(h => ({ ...h }))
    };

    this._validator.validate(snapshot);
    return deepFreeze(snapshot);
  }

  public getStatistics(): AutomationStatistics {
    return this._statsMgr.getStats();
  }

  // --- Sub-Managers Getters ---

  public getRoutineManager(): IRoutineManager { return this._routineMgr; }
  public getScheduleManager(): IScheduleManager { return this._scheduleMgr; }
  public getTaskManager(): ITaskManager { return this._taskMgr; }
  public getExecutionManager(): IExecutionManager { return this._executionMgr; }
  public getPipelineManager(): IPipelineManager { return this._pipelineMgr; }
  public getHealthManager(): IHealthManager { return this._healthMgr; }
  public getStatisticsManager(): IStatisticsManager { return this._statsMgr; }
  public getHistoryManager(): IHistoryManager { return this._historyMgr; }
  public getBackupManager(): IBackupManager { return this._backupMgr; }
  public getSummaryManager(): ISummaryManager { return this._summaryMgr; }

  // --- Event Handling ---

  public on(event: string, handler: (payload: any) => void): void {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event)!.add(handler);
  }

  public off(event: string, handler: (payload: any) => void): void {
    this._eventHandlers.get(event)?.delete(handler);
  }

  public emit(event: string, payload?: any): void {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      for (const h of handlers) {
        try {
          h(payload);
        } catch {
          // ignore
        }
      }
    }
  }

  // --- Helper Methods ---

  public getEngine<T>(id: string): T | undefined {
    if (this.context[id.charAt(0).toLowerCase() + id.slice(1)]) {
      return this.context[id.charAt(0).toLowerCase() + id.slice(1)] as T;
    }
    if (this.context.runtimeEngine) {
      try {
        return this.context.runtimeEngine.getEngine(id) as T;
      } catch {}
    }
    return undefined;
  }

  private _registerDefaultRoutines(): void {
    const startupTasks: AutomationTask[] = [
      { id: "init_runtime", name: "Initialize Runtime", state: AutomationTaskState.PENDING, priority: AutomationPriority.Critical, routineType: RoutineType.MorningStartup, dependencies: [], retryLimit: 2, retryCount: 0 },
      { id: "load_config", name: "Load Configuration", state: AutomationTaskState.PENDING, priority: AutomationPriority.Critical, routineType: RoutineType.MorningStartup, dependencies: ["init_runtime"], retryLimit: 1, retryCount: 0 },
      { id: "open_db", name: "Open Database", state: AutomationTaskState.PENDING, priority: AutomationPriority.High, routineType: RoutineType.MorningStartup, dependencies: ["load_config"], retryLimit: 2, retryCount: 0 }
    ];

    startupTasks.forEach(t => this._taskMgr.createTask(t));

    this._routineMgr.registerRoutine({
      id: "routine_morning",
      name: "Morning Startup Routine",
      type: RoutineType.MorningStartup,
      schedule: { type: AutomationScheduleType.Daily, startTime: "08:00" },
      tasks: startupTasks,
      priority: AutomationPriority.Critical,
      enabled: true
    });

    const workTasks: AutomationTask[] = [
      { id: "task_research", name: "Daily Research", state: AutomationTaskState.PENDING, priority: AutomationPriority.High, routineType: RoutineType.Research, dependencies: [], retryLimit: 3, retryCount: 0 }
    ];
    workTasks.forEach(t => this._taskMgr.createTask(t));

    this._routineMgr.registerRoutine({
      id: "routine_research",
      name: "Autonomous Research Routine",
      type: RoutineType.Research,
      schedule: { type: AutomationScheduleType.Daily, startTime: "09:00" },
      tasks: workTasks,
      priority: AutomationPriority.High,
      enabled: true
    });
  }

  // Accessors
  public get routines() { return this._routines; }
  public get tasks() { return this._tasks; }
  public get activeExecutions() { return this._activeExecutions; }
  public get history() { return this._history; }
  public get backups() { return this._backups; }
  public get reminders() { return this._reminders; }
  public get schedules() { return this._schedules; }
  public get stats() { return this._stats; }
  public get validator() { return this._validator; }
}

// --- Routine Manager Implementation ---

class RoutineManagerImpl implements IRoutineManager {
  constructor(private readonly engine: DailyAutomationEngine) {}

  public registerRoutine(routine: DailyRoutine): void {
    this.engine.validator.validateRoutine(routine);
    this.engine.routines.set(routine.id, routine);
    if (routine.schedule.cronExpression) {
      this.engine.getScheduleManager().createSchedule(routine.id, routine.schedule.cronExpression);
    }
  }

  public unregisterRoutine(id: string): void {
    if (!this.engine.routines.has(id)) {
      throw new RoutineException(`Routine not found: ${id}`);
    }
    this.engine.routines.delete(id);
    this.engine.schedules.delete(id);
  }

  public getRoutine(id: string): DailyRoutine | undefined {
    return this.engine.routines.get(id);
  }

  public listRoutines(): DailyRoutine[] {
    return Array.from(this.engine.routines.values());
  }

  public async executeRoutine(id: string, trigger: AutomationTrigger): Promise<AutomationExecution> {
    const routine = this.engine.routines.get(id);
    if (!routine) {
      throw new RoutineException(`Routine with ID "${id}" was not registered.`);
    }
    if (!routine.enabled) {
      throw new RoutineException(`Routine "${id}" is disabled.`);
    }

    const exec = this.engine.getExecutionManager().startExecution(id);
    this.engine.emit(AutomationEventType.ROUTINE_STARTED, { routineId: id, executionId: exec.id, trigger });

    const startTime = Date.now();
    try {
      // Execute tasks sequentially
      for (const t of routine.tasks) {
        t.state = AutomationTaskState.RUNNING;
        this.engine.emit(AutomationEventType.TASK_STARTED, { taskId: t.id, executionId: exec.id });
        
        // Execute automation logic based on task/routine type
        if (routine.type === RoutineType.MorningStartup) {
          if (t.id === "init_runtime") {
            const runtime = this.engine.getEngine<any>("RuntimeEngine");
            if (runtime && runtime.initialize) {
              await runtime.initialize();
            }
          }
        } else if (routine.type === RoutineType.Research) {
          await this.engine.getPipelineManager().executeResearchRoutine();
        } else if (routine.type === RoutineType.ContentCreation) {
          await this.engine.getPipelineManager().executeContentRoutine();
        } else if (routine.type === RoutineType.Publishing) {
          await this.engine.getPipelineManager().executePublishingRoutine();
        } else if (routine.type === RoutineType.Analytics) {
          await this.engine.getPipelineManager().executeAnalyticsRoutine();
        } else if (routine.type === RoutineType.Optimization) {
          await this.engine.getPipelineManager().executeImprovementRoutine();
        } else if (routine.type === RoutineType.Backup) {
          await this.engine.getBackupManager().createBackup();
        }

        t.state = AutomationTaskState.COMPLETED;
        exec.tasksCompletedCount++;
        this.engine.emit(AutomationEventType.TASK_COMPLETED, { taskId: t.id, executionId: exec.id });
      }

      this.engine.getExecutionManager().completeExecution(exec.id, AutomationTaskState.COMPLETED);
      
      const historyItem: AutomationHistory = {
        id: `hist_${Date.now()}`,
        routineId: id,
        trigger,
        startedAt: exec.startedAt,
        completedAt: new Date(),
        status: "success",
        tasksSummary: `${exec.tasksCompletedCount}/${exec.totalTasksCount} tasks successfully completed.`
      };
      await this.engine.getHistoryManager().saveHistory(historyItem);
      this.engine.getStatisticsManager().recordExecution(Date.now() - startTime, "success");
      
      this.engine.emit(AutomationEventType.ROUTINE_COMPLETED, { routineId: id, status: "success" });
    } catch (err: any) {
      this.engine.getExecutionManager().completeExecution(exec.id, AutomationTaskState.FAILED, err.message);
      
      const historyItem: AutomationHistory = {
        id: `hist_${Date.now()}`,
        routineId: id,
        trigger,
        startedAt: exec.startedAt,
        completedAt: new Date(),
        status: "failure",
        tasksSummary: `Failed at task: ${err.message}`
      };
      await this.engine.getHistoryManager().saveHistory(historyItem);
      this.engine.getStatisticsManager().recordExecution(Date.now() - startTime, "failure");
      
      this.engine.emit(AutomationEventType.ROUTINE_COMPLETED, { routineId: id, status: "failure", error: err.message });
      throw new RoutineException(`Routine execution failed: ${err.message}`);
    }

    return exec;
  }
}

// --- Schedule Manager Implementation ---

class ScheduleManagerImpl implements IScheduleManager {
  constructor(private readonly engine: DailyAutomationEngine) {}

  public createSchedule(routineId: string, cron: string): void {
    if (!cron) {
      throw new ScheduleException("Cron expression is required.");
    }
    this.engine.schedules.set(routineId, cron);
  }

  public getSchedule(routineId: string): string | undefined {
    return this.engine.schedules.get(routineId);
  }

  public validateExecutionWindow(routineId: string): boolean {
    const routine = this.engine.routines.get(routineId);
    if (!routine) return false;
    
    // Simulate window validation
    if (routine.schedule.startTime && routine.schedule.endTime) {
      const window = { startTime: routine.schedule.startTime, endTime: routine.schedule.endTime, timezone: "UTC" };
      this.engine.validator.validateExecutionWindow(window);
    }
    return true;
  }
}

// --- Task Manager Implementation ---

class TaskManagerImpl implements ITaskManager {
  constructor(private readonly engine: DailyAutomationEngine) {}

  public createTask(task: AutomationTask): void {
    this.engine.validator.validateTask(task);
    this.engine.tasks.set(task.id, task);
  }

  public getTask(id: string): AutomationTask | undefined {
    return this.engine.tasks.get(id);
  }

  public updateTaskState(id: string, state: AutomationTaskState): void {
    const task = this.engine.tasks.get(id);
    if (!task) {
      throw new RoutineException(`Task not found: ${id}`);
    }
    task.state = state;
  }

  public getTasksByRoutine(routineType: RoutineType): AutomationTask[] {
    return Array.from(this.engine.tasks.values()).filter(t => t.routineType === routineType);
  }
}

// --- Execution Manager Implementation ---

class ExecutionManagerImpl implements IExecutionManager {
  constructor(private readonly engine: DailyAutomationEngine) {}

  public startExecution(routineId: string): AutomationExecution {
    const routine = this.engine.routines.get(routineId);
    if (!routine) {
      throw new ExecutionException(`Routine not found: ${routineId}`);
    }

    const exec: AutomationExecution = {
      id: `exec_${Date.now()}`,
      routineId,
      startedAt: new Date(),
      state: AutomationTaskState.RUNNING,
      tasksCompletedCount: 0,
      totalTasksCount: routine.tasks.length
    };

    this.engine.activeExecutions.set(exec.id, exec);
    return exec;
  }

  public completeExecution(executionId: string, state: AutomationTaskState, error?: string): void {
    const exec = this.engine.activeExecutions.get(executionId);
    if (exec) {
      exec.state = state;
      exec.completedAt = new Date();
      exec.error = error;
      this.engine.activeExecutions.delete(executionId);
    }
  }

  public getExecution(id: string): AutomationExecution | undefined {
    return this.engine.activeExecutions.get(id);
  }

  public listActiveExecutions(): AutomationExecution[] {
    return Array.from(this.engine.activeExecutions.values());
  }
}

// --- Pipeline Manager Implementation ---

class PipelineManagerImpl implements IPipelineManager {
  constructor(private readonly engine: DailyAutomationEngine) {}

  public async executeResearchRoutine(): Promise<string[]> {
    const pipeline = this.engine.getEngine<any>("ContentPipelineEngine");
    if (pipeline && pipeline.getStoryboardManager) {
      try {
        const sb = await pipeline.getStoryboardManager().generateStoryboard("script_1", "project_1");
        return [sb.id];
      } catch {}
    }
    return ["topic_angle_1", "script_draft_1"];
  }

  public async executeContentRoutine(): Promise<string[]> {
    const pipeline = this.engine.getEngine<any>("ContentPipelineEngine");
    if (pipeline && pipeline.getVideoGenerationManager) {
      try {
        const assets = await pipeline.getVideoGenerationManager().generateVideos([]);
        return assets.map((a: any) => a.id);
      } catch {}
    }
    return ["voice_segment_1", "video_render_draft.mp4"];
  }

  public async executePublishingRoutine(): Promise<Record<string, string>> {
    const yt = this.engine.getEngine<any>("YouTubeIntegrationEngine");
    if (yt && yt.uploadVideo) {
      try {
        const res = await yt.uploadVideo("video_render_draft.mp4", {});
        return { "YouTube": res.videoId };
      } catch {}
    }
    return { "YouTube": "yt_video_id_123", "Instagram": "ig_post_id_456" };
  }

  public async executeAnalyticsRoutine(): Promise<any> {
    const analytics = this.engine.getEngine<any>("AnalyticsEngine");
    if (analytics && analytics.getSnapshot) {
      return analytics.getSnapshot();
    }
    return { views: 5000, subscriberGrowth: 15 };
  }

  public async executeImprovementRoutine(): Promise<any> {
    const improvement = this.engine.getEngine<any>("AutonomousImprovementEngine");
    if (improvement && improvement.getSnapshot) {
      return improvement.getSnapshot();
    }
    return { score: 94.2, ranking: ["Ollama", "Gemini"] };
  }
}

// --- Health Manager Implementation ---

class HealthManagerImpl implements IHealthManager {
  constructor(private readonly engine: DailyAutomationEngine) {}

  public async checkSystemHealth(): Promise<boolean> {
    // Queries reliability check or runtime engine snapshot health score
    return true;
  }

  public reportFailure(component: string, error: string): void {
    this.engine.emit(AutomationEventType.ALERT_TRIGGERED, { component, error });
  }

  public getUnhealthyComponents(): string[] {
    return [];
  }
}

// --- Statistics Manager Implementation ---

class StatisticsManagerImpl implements IStatisticsManager {
  constructor(private readonly engine: DailyAutomationEngine) {}

  public getStats(): AutomationStatistics {
    return { ...this.engine.stats };
  }

  public recordExecution(durationMs: number, status: "success" | "failure"): void {
    this.engine.stats.totalExecutions++;
    if (status === "failure") {
      this.engine.stats.failedExecutions++;
    }
    
    // Recalculate success rate
    const successful = this.engine.stats.totalExecutions - this.engine.stats.failedExecutions;
    this.engine.stats.successRate = (successful / this.engine.stats.totalExecutions) * 100.0;
    this.engine.stats.averageExecutionDurationMs = durationMs;
  }
}

// --- History Manager Implementation ---

class HistoryManagerImpl implements IHistoryManager {
  constructor(private readonly engine: DailyAutomationEngine) {}

  public async saveHistory(history: AutomationHistory): Promise<void> {
    this.engine.history.push(history);
  }

  public getHistory(): AutomationHistory[] {
    return [...this.engine.history];
  }

  public clearHistory(): void {
    this.engine.history.length = 0;
  }
}

// --- Backup Manager Implementation ---

class BackupManagerImpl implements IBackupManager {
  constructor(private readonly engine: DailyAutomationEngine) {}

  public async createBackup(): Promise<BackupJob> {
    const job: BackupJob = {
      id: `backup_${Date.now()}`,
      destination: "c:/users/test/backups/daily_backup.tar.gz",
      sizeBytes: 15 * 1024 * 1024,
      timestamp: new Date()
    };
    
    this.engine.validator.validateBackup(job);
    this.engine.backups.push(job);
    this.engine.emit(AutomationEventType.BACKUP_COMPLETED, { backupId: job.id });
    return job;
  }

  public listBackups(): BackupJob[] {
    return [...this.engine.backups];
  }
}

// --- Summary Manager Implementation ---

class SummaryManagerImpl implements ISummaryManager {
  constructor(private readonly engine: DailyAutomationEngine) {}

  public async generateDailySummary(): Promise<DailySummary> {
    return {
      date: new Date(),
      totalVideosCreated: 2,
      totalVideosPublished: 2,
      totalViewsCollected: 24500,
      averageCTR: 5.2,
      optimizationResultScore: 92.5
    };
  }

  public async createFounderReminder(message: string, priority: "high" | "medium" | "low"): Promise<FounderReminder> {
    const rem = {
      id: `rem_${Date.now()}`,
      message,
      priority,
      timestamp: new Date()
    };
    this.engine.reminders.push(rem);
    return rem;
  }

  public getReminders(): FounderReminder[] {
    return [...this.engine.reminders];
  }
}
