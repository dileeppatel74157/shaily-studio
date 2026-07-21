import { DailyAutomationState } from "./DailyAutomationState";
import { AutomationTaskState } from "./AutomationTaskState";
import { RoutineType } from "./RoutineType";
import { AutomationPriority } from "./AutomationPriority";
import { AutomationTrigger } from "./AutomationTrigger";
import {
  DailyRoutine,
  AutomationTask,
  AutomationExecution,
  AutomationHistory,
  AutomationSnapshot,
  AutomationStatistics,
  DailySummary,
  FounderReminder,
  BackupJob
} from "./models";

export interface IDailyAutomationEngine {
  getState(): DailyAutomationState;
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  
  getSnapshot(): AutomationSnapshot;
  getStatistics(): AutomationStatistics;
  
  getRoutineManager(): IRoutineManager;
  getScheduleManager(): IScheduleManager;
  getTaskManager(): ITaskManager;
  getExecutionManager(): IExecutionManager;
  getPipelineManager(): IPipelineManager;
  getHealthManager(): IHealthManager;
  getStatisticsManager(): IStatisticsManager;
  getHistoryManager(): IHistoryManager;
  getBackupManager(): IBackupManager;
  getSummaryManager(): ISummaryManager;
  
  on(event: string, handler: (payload: any) => void): void;
  off(event: string, handler: (payload: any) => void): void;
}

export interface IRoutineManager {
  registerRoutine(routine: DailyRoutine): void;
  unregisterRoutine(id: string): void;
  getRoutine(id: string): DailyRoutine | undefined;
  listRoutines(): DailyRoutine[];
  executeRoutine(id: string, trigger: AutomationTrigger): Promise<AutomationExecution>;
}

export interface IScheduleManager {
  createSchedule(routineId: string, cron: string): void;
  getSchedule(routineId: string): string | undefined;
  validateExecutionWindow(routineId: string): boolean;
}

export interface ITaskManager {
  createTask(task: AutomationTask): void;
  getTask(id: string): AutomationTask | undefined;
  updateTaskState(id: string, state: AutomationTaskState): void;
  getTasksByRoutine(routineType: RoutineType): AutomationTask[];
}

export interface IExecutionManager {
  startExecution(routineId: string): AutomationExecution;
  completeExecution(executionId: string, state: AutomationTaskState, error?: string): void;
  getExecution(id: string): AutomationExecution | undefined;
  listActiveExecutions(): AutomationExecution[];
}

export interface IPipelineManager {
  executeResearchRoutine(): Promise<string[]>;
  executeContentRoutine(): Promise<string[]>;
  executePublishingRoutine(): Promise<Record<string, string>>;
  executeAnalyticsRoutine(): Promise<any>;
  executeImprovementRoutine(): Promise<any>;
}

export interface IHealthManager {
  checkSystemHealth(): Promise<boolean>;
  reportFailure(component: string, error: string): void;
  getUnhealthyComponents(): string[];
}

export interface IStatisticsManager {
  getStats(): AutomationStatistics;
  recordExecution(durationMs: number, status: "success" | "failure"): void;
}

export interface IHistoryManager {
  saveHistory(history: AutomationHistory): Promise<void>;
  getHistory(): AutomationHistory[];
  clearHistory(): void;
}

export interface IBackupManager {
  createBackup(): Promise<BackupJob>;
  listBackups(): BackupJob[];
}

export interface ISummaryManager {
  generateDailySummary(): Promise<DailySummary>;
  createFounderReminder(message: string, priority: "high" | "medium" | "low"): Promise<FounderReminder>;
  getReminders(): FounderReminder[];
}
