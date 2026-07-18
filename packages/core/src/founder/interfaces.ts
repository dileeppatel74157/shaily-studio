import { FounderState }       from "./FounderState";
import { WorkspaceMode }      from "./WorkspaceMode";
import { AlertSeverity }      from "./AlertSeverity";
import { TimelineEventType }  from "./TimelineEventType";
import { AgentStatus }        from "./AgentStatus";
import {
  FounderDashboard,
  FounderWorkspace,
  WorkspaceSnapshot,
  DashboardSnapshot,
  PipelineStatus,
  AgentMonitor,
  ExecutionTimeline,
  TimelineEvent,
  ExecutionLog,
  Alert,
  Notification,
  ResourceUsage,
  GpuUsage,
  SystemHealth,
  ExecutionProgress,
  ExecutionSummary,
  WorkspaceReport,
  FounderSettings,
  CommandHistory,
} from "./models";

// ─── Founder Engine ───────────────────────────────────────────────────────────

export interface IFounderEngine {
  readonly state: FounderState;

  initialize(): Promise<void>;
  start():      Promise<void>;
  stop():       Promise<void>;
  recover():    Promise<void>;

  /** Collect a full workspace snapshot */
  snapshot(label?: string): Promise<WorkspaceSnapshot>;

  /** Refresh dashboard with latest state from all engines */
  refresh(): Promise<FounderWorkspace>;

  /** Get the current workspace */
  getWorkspace(): FounderWorkspace;

  /** Get alerts, optionally filtering by resolved status */
  getAlerts(resolved?: boolean): Alert[];

  /** Resolve an alert by ID */
  resolveAlert(alertId: string): void;

  /** Get execution logs (most recent first) */
  getLogs(limit?: number): ExecutionLog[];

  /** Get system health */
  getHealth(): SystemHealth;

  /** Get resource usage */
  getResources(): ResourceUsage;

  /** Get execution history */
  getHistory(): ExecutionSummary[];
}

// ─── Dashboard Manager ────────────────────────────────────────────────────────

export interface IDashboardManager {
  createDashboard(name: string, mode: WorkspaceMode): FounderDashboard;
  updateWidget(dashboardId: string, widgetId: string, data: Record<string, unknown>): void;
  getDashboard(dashboardId: string): FounderDashboard | undefined;
  snapshot(dashboardId: string): DashboardSnapshot;
}

// ─── Timeline Manager ─────────────────────────────────────────────────────────

export interface ITimelineManager {
  record(event: Omit<TimelineEvent, "id">): TimelineEvent;
  getTimeline(correlationId?: string): ExecutionTimeline;
  getEvents(engineKey?: string): TimelineEvent[];
  clear(): void;
}

// ─── Agent Monitor ────────────────────────────────────────────────────────────

export interface IAgentMonitor {
  register(agentId: string, name: string): void;
  update(agentId: string, status: AgentStatus, task?: string): void;
  recordRun(agentId: string, success: boolean, durationMs: number): void;
  getAgent(agentId: string): AgentMonitor | undefined;
  getAllAgents(): AgentMonitor[];
}

// ─── Alert Manager ────────────────────────────────────────────────────────────

export interface IAlertManager {
  createAlert(
    severity: AlertSeverity,
    title: string,
    message: string,
    engineKey: string,
    metadata?: Record<string, unknown>
  ): Alert;
  resolve(alertId: string): void;
  getAlerts(resolved?: boolean): Alert[];
  getCriticalCount(): number;
}

// ─── Notification Manager ─────────────────────────────────────────────────────

export interface INotificationManager {
  send(title: string, body: string, severity: AlertSeverity, expiresAt?: Date): Notification;
  markRead(notificationId: string): void;
  getUnread(): Notification[];
  getAll(): Notification[];
}

// ─── Workspace Manager ────────────────────────────────────────────────────────

export interface IWorkspaceManager {
  getWorkspace(): FounderWorkspace;
  updateMode(mode: WorkspaceMode): void;
  snapshot(label?: string): WorkspaceSnapshot;
  getSnapshots(): WorkspaceSnapshot[];
  generateReport(periodDays?: number): WorkspaceReport;
}

// ─── Resource Monitor ─────────────────────────────────────────────────────────

export interface IResourceMonitor {
  capture(): ResourceUsage;
  getLatest(): ResourceUsage;
  getHistory(): ResourceUsage[];
  isOverloaded(): boolean;
}

// ─── Log Collector ────────────────────────────────────────────────────────────

export interface ILogCollector {
  collect(
    level: ExecutionLog["level"],
    engineKey: string,
    engineName: string,
    message: string,
    metadata?: Record<string, unknown>
  ): ExecutionLog;
  getLogs(engineKey?: string, limit?: number): ExecutionLog[];
  clear(): void;
}

// ─── System Health Monitor ────────────────────────────────────────────────────

export interface ISystemHealthMonitor {
  compute(
    engines: Record<string, boolean>,
    providers: Record<string, boolean>,
    resources: ResourceUsage,
    criticalAlerts: number
  ): SystemHealth;
  getLatest(): SystemHealth;
}
