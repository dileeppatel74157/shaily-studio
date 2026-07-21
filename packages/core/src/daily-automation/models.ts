import { DailyAutomationState } from "./DailyAutomationState";
import { AutomationScheduleType } from "./AutomationScheduleType";
import { AutomationPriority } from "./AutomationPriority";
import { AutomationTaskState } from "./AutomationTaskState";
import { RoutineType } from "./RoutineType";
import { AutomationTrigger } from "./AutomationTrigger";

export interface DailyRoutine {
  id: string;
  name: string;
  type: RoutineType;
  schedule: AutomationSchedule;
  tasks: AutomationTask[];
  priority: AutomationPriority;
  enabled: boolean;
}

export interface AutomationTask {
  id: string;
  name: string;
  state: AutomationTaskState;
  priority: AutomationPriority;
  routineType: RoutineType;
  dependencies: string[];
  retryLimit: number;
  retryCount: number;
}

export interface AutomationExecution {
  id: string;
  routineId: string;
  startedAt: Date;
  completedAt?: Date;
  state: AutomationTaskState;
  tasksCompletedCount: number;
  totalTasksCount: number;
  error?: string;
}

export interface AutomationCheckpoint {
  id: string;
  executionId: string;
  name: string;
  timestamp: Date;
  metrics: AutomationMetrics;
}

export interface AutomationSchedule {
  type: AutomationScheduleType;
  cronExpression?: string;
  intervalMs?: number;
  startTime?: string; // HH:MM format
  endTime?: string;
}

export interface AutomationHistory {
  id: string;
  routineId: string;
  trigger: AutomationTrigger;
  startedAt: Date;
  completedAt: Date;
  status: "success" | "failure";
  tasksSummary: string;
}

export interface AutomationSnapshot {
  timestamp: Date;
  state: DailyAutomationState;
  health: AutomationHealth;
  statistics: AutomationStatistics;
  activeRoutines: DailyRoutine[];
  activeExecutions: AutomationExecution[];
  recentHistory: AutomationHistory[];
}

export interface AutomationStatistics {
  successRate: number;
  totalExecutions: number;
  failedExecutions: number;
  uptimeSeconds: number;
  averageExecutionDurationMs: number;
}

export interface AutomationMetrics {
  cpuUsagePercent: number;
  memoryUsedBytes: number;
  tasksThroughput: number;
}

export interface RoutineDefinition {
  name: string;
  type: RoutineType;
  schedule: AutomationSchedule;
  tasks: Omit<AutomationTask, "state" | "retryCount">[];
  priority: AutomationPriority;
}

export interface ExecutionWindow {
  startTime: string;
  endTime: string;
  timezone: string;
}

export interface ExecutionSummary {
  executionId: string;
  routineType: RoutineType;
  durationMs: number;
  state: AutomationTaskState;
  timestamp: Date;
}

export interface AutomationPlan {
  id: string;
  name: string;
  steps: string[];
  estimatedDurationMs: number;
}

export interface PipelineExecution {
  pipelineId: string;
  stagesCount: number;
  currentStage: string;
  progressPercent: number;
}

export interface ContentJob {
  id: string;
  title: string;
  stage: "Scripting" | "Storyboarding" | "AssetsGeneration" | "Rendering" | "Completed";
  progressPercent: number;
}

export interface PublishingJob {
  id: string;
  contentId: string;
  platform: string;
  status: "pending" | "uploading" | "published" | "failed";
}

export interface AnalyticsJob {
  id: string;
  targetDate: Date;
  platforms: string[];
  status: "completed" | "running";
}

export interface OptimizationJob {
  id: string;
  target: string;
  scoreBefore: number;
  scoreAfter: number;
}

export interface BackupJob {
  id: string;
  destination: string;
  sizeBytes: number;
  timestamp: Date;
}

export interface ShutdownJob {
  id: string;
  timestamp: Date;
  snapshotsSaved: boolean;
  cacheFlushed: boolean;
}

export interface MorningRoutine {
  routineId: string;
  runtimeState: string;
  providerStatus: Record<string, string>;
}

export interface EveningRoutine {
  routineId: string;
  backupStatus: string;
  shutdownStatus: string;
}

export interface TaskQueue {
  name: string;
  tasks: AutomationTask[];
  capacity: number;
}

export interface ExecutionTimeline {
  routineId: string;
  events: { name: string; timestamp: Date }[];
}

export interface AutomationHealth {
  status: "healthy" | "unhealthy" | "critical";
  lastCheckTime: Date;
  activeErrors: string[];
}

export interface AutomationReport {
  id: string;
  timestamp: Date;
  overallHealth: string;
  statistics: AutomationStatistics;
  recommendations: string[];
}

export interface DailySummary {
  date: Date;
  totalVideosCreated: number;
  totalVideosPublished: number;
  totalViewsCollected: number;
  averageCTR: number;
  optimizationResultScore: number;
}

export interface FounderReminder {
  id: string;
  message: string;
  priority: "high" | "medium" | "low";
  timestamp: Date;
}

export interface AutomationTriggerConfig {
  source: AutomationTrigger;
  details: string;
}

export interface AutomationJob {
  id: string;
  name: string;
  schedule: AutomationSchedule;
  active: boolean;
}
