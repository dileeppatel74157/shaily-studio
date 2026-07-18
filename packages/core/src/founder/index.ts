// ─── Enums ────────────────────────────────────────────────────────────────────
export { FounderState }        from "./FounderState";
export { WorkspaceMode }       from "./WorkspaceMode";
export { ExecutionStatus }     from "./ExecutionStatus";
export { AlertSeverity }       from "./AlertSeverity";
export { TimelineEventType }   from "./TimelineEventType";
export { AgentStatus }         from "./AgentStatus";
export { DashboardWidgetType } from "./DashboardWidgetType";

// ─── Models ───────────────────────────────────────────────────────────────────
export type {
  WidgetState,
  WidgetLayout,
  FounderDashboard,
  PipelineStage,
  PipelineStatus,
  AgentStatistics,
  AgentMonitor,
  TimelineEvent,
  ExecutionTimeline,
  ExecutionLog,
  Alert,
  Notification,
  GpuUsage,
  MemoryUsage,
  TokenUsage,
  CostUsage,
  ResourceUsage,
  ExecutionProgress,
  ExecutionMetrics,
  ExecutionSummary,
  SystemHealth,
  FounderWorkspace,
  WorkspaceSnapshot,
  DashboardSnapshot,
  WorkspaceReport,
  FounderSettings,
  CommandHistory,
} from "./models";

// ─── Interfaces ───────────────────────────────────────────────────────────────
export type {
  IFounderEngine,
  IDashboardManager,
  ITimelineManager,
  IAgentMonitor,
  IAlertManager,
  INotificationManager,
  IWorkspaceManager,
  IResourceMonitor,
  ILogCollector,
  ISystemHealthMonitor,
} from "./interfaces";

// ─── Engine ───────────────────────────────────────────────────────────────────
export { FounderEngine }    from "./FounderEngine";
export { FounderBuilder }   from "./FounderBuilder";
export { FounderValidator } from "./FounderValidator";

// ─── Exception Types ──────────────────────────────────────────────────────────
export {
  FounderException,
  DashboardException,
  AlertException,
  TimelineException,
  WorkspaceException,
  FounderValidationException,
  deepFreeze,
} from "./types";
