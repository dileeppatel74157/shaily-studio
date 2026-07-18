import { FounderState }         from "./FounderState";
import { WorkspaceMode }        from "./WorkspaceMode";
import { ExecutionStatus }      from "./ExecutionStatus";
import { AlertSeverity }        from "./AlertSeverity";
import { TimelineEventType }    from "./TimelineEventType";
import { AgentStatus }          from "./AgentStatus";
import { DashboardWidgetType }  from "./DashboardWidgetType";

// ─── Widget State ─────────────────────────────────────────────────────────────

export interface WidgetState {
  id:        string;
  type:      DashboardWidgetType;
  title:     string;
  data:      Record<string, unknown>;
  lastUpdated: Date;
  healthy:   boolean;
  visible:   boolean;
}

// ─── Widget Layout ────────────────────────────────────────────────────────────

export interface WidgetLayout {
  widgetId: string;
  row:      number;
  col:      number;
  width:    number;  // grid columns (1–12)
  height:   number;  // grid rows
}

// ─── Founder Dashboard ────────────────────────────────────────────────────────

export interface FounderDashboard {
  id:       string;
  name:     string;
  mode:     WorkspaceMode;
  widgets:  WidgetState[];
  layout:   WidgetLayout[];
  createdAt: Date;
  updatedAt: Date;
}

// ─── Pipeline Stage ───────────────────────────────────────────────────────────

export interface PipelineStage {
  name:          string;
  engineKey:     string;       // e.g. "researchEngine"
  status:        ExecutionStatus;
  startedAt?:    Date;
  completedAt?:  Date;
  durationMs?:   number;
  latencyMs?:    number;
  retryCount:    number;
  errorMessage?: string;
}

// ─── Pipeline Status ──────────────────────────────────────────────────────────

export interface PipelineStatus {
  id:             string;
  correlationId?: string;
  stages:         PipelineStage[];
  overallStatus:  ExecutionStatus;
  startedAt:      Date;
  completedAt?:   Date;
  totalDurationMs?: number;
  bottleneck?:    string;   // name of slowest stage
}

// ─── Agent Statistics ─────────────────────────────────────────────────────────

export interface AgentStatistics {
  totalRuns:         number;
  successfulRuns:    number;
  failedRuns:        number;
  avgDurationMs:     number;
  totalDurationMs:   number;
  recoveryCount:     number;
  lastRunAt?:        Date;
}

// ─── Agent Monitor ────────────────────────────────────────────────────────────

export interface AgentMonitor {
  agentId:     string;
  name:        string;
  status:      AgentStatus;
  currentTask: string;
  statistics:  AgentStatistics;
  updatedAt:   Date;
}

// ─── Timeline Event ───────────────────────────────────────────────────────────

export interface TimelineEvent {
  id:          string;
  type:        TimelineEventType;
  engineKey:   string;
  engineName:  string;
  description: string;
  timestamp:   Date;
  durationMs?: number;
  metadata:    Record<string, unknown>;
}

// ─── Execution Timeline ───────────────────────────────────────────────────────

export interface ExecutionTimeline {
  id:              string;
  correlationId?:  string;
  events:          TimelineEvent[];
  totalDurationMs: number;
  startedAt:       Date;
  completedAt?:    Date;
}

// ─── Execution Log ────────────────────────────────────────────────────────────

export interface ExecutionLog {
  id:         string;
  level:      "INFO" | "WARN" | "ERROR" | "DEBUG";
  engineKey:  string;
  engineName: string;
  message:    string;
  timestamp:  Date;
  metadata:   Record<string, unknown>;
}

// ─── Alert ────────────────────────────────────────────────────────────────────

export interface Alert {
  id:           string;
  severity:     AlertSeverity;
  title:        string;
  message:      string;
  engineKey:    string;
  source:       string;
  resolved:     boolean;
  resolvedAt?:  Date;
  createdAt:    Date;
  metadata:     Record<string, unknown>;
}

// ─── Notification ─────────────────────────────────────────────────────────────

export interface Notification {
  id:        string;
  title:     string;
  body:      string;
  severity:  AlertSeverity;
  read:      boolean;
  createdAt: Date;
  expiresAt?: Date;
  link?:     string;
}

// ─── GPU Usage ────────────────────────────────────────────────────────────────

export interface GpuUsage {
  deviceId:         string;
  utilizationPercent: number;  // 0–100
  memoryUsedMb:     number;
  memoryTotalMb:    number;
  temperatureC:     number;
  powerWatts:       number;
  capturedAt:       Date;
}

// ─── Memory Usage ─────────────────────────────────────────────────────────────

export interface MemoryUsage {
  usedMb:    number;
  totalMb:   number;
  freeMb:    number;
  usedPercent: number;  // 0–100
  capturedAt: Date;
}

// ─── Token Usage ──────────────────────────────────────────────────────────────

export interface TokenUsage {
  promptTokens:     number;
  completionTokens: number;
  totalTokens:      number;
  costUsd:          number;
  modelId:          string;
  capturedAt:       Date;
}

// ─── Cost Usage ───────────────────────────────────────────────────────────────

export interface CostUsage {
  totalUsd:        number;
  apiCostUsd:      number;
  computeCostUsd:  number;
  storageCostUsd:  number;
  budgetUsd:       number;
  budgetUsedPercent: number;  // 0–100
  capturedAt:      Date;
}

// ─── Resource Usage ───────────────────────────────────────────────────────────

export interface ResourceUsage {
  cpuPercent:     number;  // 0–100
  ramMb:          number;
  storageGb:      number;
  networkMbps:    number;
  gpus:           GpuUsage[];
  memory:         MemoryUsage;
  tokens:         TokenUsage;
  costs:          CostUsage;
  capturedAt:     Date;
}

// ─── Execution Progress ───────────────────────────────────────────────────────

export interface ExecutionProgress {
  correlationId:     string;
  totalStages:       number;
  completedStages:   number;
  failedStages:      number;
  progressPercent:   number;  // 0–100
  estimatedRemainingMs?: number;
  currentStage?:     string;
  status:            ExecutionStatus;
}

// ─── Execution Metrics ────────────────────────────────────────────────────────

export interface ExecutionMetrics {
  correlationId:    string;
  totalDurationMs:  number;
  avgStageDurationMs: number;
  slowestStage:     string;
  fastestStage:     string;
  retryCount:       number;
  errorCount:       number;
  successRate:      number;  // 0–1
}

// ─── Execution Summary ────────────────────────────────────────────────────────

export interface ExecutionSummary {
  id:              string;
  correlationId:   string;
  pipeline:        PipelineStatus;
  timeline:        ExecutionTimeline;
  metrics:         ExecutionMetrics;
  resources:       ResourceUsage;
  alerts:          Alert[];
  completedAt:     Date;
}

// ─── System Health ────────────────────────────────────────────────────────────

export interface SystemHealth {
  overallScore:      number;  // 0–100
  engineHealth:      Record<string, number>;    // engineKey → score 0–100
  providerHealth:    Record<string, boolean>;   // provider → reachable
  memoryHealth:      number;  // 0–100
  queueHealth:       number;  // 0–100
  healthy:           boolean;
  criticalAlerts:    number;
  capturedAt:        Date;
}

// ─── Founder Workspace ────────────────────────────────────────────────────────

export interface FounderWorkspace {
  id:           string;
  name:         string;
  mode:         WorkspaceMode;
  dashboard:    FounderDashboard;
  pipeline?:    PipelineStatus;
  agents:       AgentMonitor[];
  resources:    ResourceUsage;
  health:       SystemHealth;
  activeAlerts: Alert[];
  recentLogs:   ExecutionLog[];
  updatedAt:    Date;
}

// ─── Workspace Snapshot ───────────────────────────────────────────────────────

export interface WorkspaceSnapshot {
  id:          string;
  workspaceId: string;
  state:       Readonly<FounderWorkspace>;
  capturedAt:  Date;
  label?:      string;
}

// ─── Dashboard Snapshot ───────────────────────────────────────────────────────

export interface DashboardSnapshot {
  id:          string;
  dashboardId: string;
  widgets:     Readonly<WidgetState[]>;
  capturedAt:  Date;
}

// ─── Workspace Report ─────────────────────────────────────────────────────────

export interface WorkspaceReport {
  id:              string;
  workspaceId:     string;
  generatedAt:     Date;
  periodStart:     Date;
  periodEnd:       Date;
  executionCount:  number;
  successCount:    number;
  failureCount:    number;
  alertCount:      number;
  totalCostUsd:    number;
  totalTokens:     number;
  avgPipelineDurationMs: number;
  topBottlenecks:  string[];
  recommendations: string[];
}

// ─── Founder Settings ─────────────────────────────────────────────────────────

export interface FounderSettings {
  budgetLimitUsd:         number;
  gpuOverloadThreshold:   number;  // % at which GPU alert fires
  memoryOverloadThreshold:number;  // % 
  tokenBudgetPerRun:      number;
  autoResolveAlerts:      boolean;
  snapshotIntervalMs:     number;
  maxLogEntries:          number;
  notificationsEnabled:   boolean;
  decisionFeedbackEnabled:boolean;
}

// ─── Command History ──────────────────────────────────────────────────────────

export interface CommandHistory {
  id:          string;
  command:     string;
  source:      "USER" | "SYSTEM" | "AGENT";
  issuedAt:    Date;
  completedAt?: Date;
  result?:     "SUCCESS" | "FAILURE" | "PENDING";
  metadata:    Record<string, unknown>;
}
