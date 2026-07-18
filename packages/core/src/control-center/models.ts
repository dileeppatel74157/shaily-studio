import { ControlCenterState }    from "./ControlCenterState";
import { OverrideType }          from "./OverrideType";
import { EmergencyLevel }        from "./EmergencyLevel";
import { BudgetState }           from "./BudgetState";
import { NotificationPriority }  from "./NotificationPriority";
import { ExecutionPermission }   from "./ExecutionPermission";
import { ControlAction }         from "./ControlAction";

// ─── Core Models ──────────────────────────────────────────────────────────────

export interface ControlRequest {
  id: string;
  action: ControlAction;
  targetWorkflowId?: string;
  targetStage?: string;
  payload?: Record<string, unknown>;
  timestamp: Date;
  requester: "FOUNDER" | "SYSTEM" | "AGENT";
}

export interface ControlResponse {
  id: string;
  requestId: string;
  success: boolean;
  state: ControlCenterState;
  snapshot?: ControlSnapshot;
  errorMessage?: string;
  timestamp: Date;
}

export interface ManualOverride {
  id: string;
  workflowId: string;
  stageName: string;
  type: OverrideType;
  overriddenData: Record<string, unknown>;
  reason: string;
  appliedBy: string;
  appliedAt: Date;
  active: boolean;
}

export interface ExecutionPermissionRule {
  id: string;
  workflowId: string;
  action: ControlAction;
  permission: ExecutionPermission;
  grantedBy?: string;
  grantedAt?: Date;
  expiresAt?: Date;
}

export interface EmergencyStop {
  id: string;
  level: EmergencyLevel;
  reason: string;
  triggeredBy: string;
  triggeredAt: Date;
  active: boolean;
  snapshotId?: string;  // references EmergencySnapshot
}

export interface EmergencySnapshot {
  id: string;
  stopId: string;
  runningWorkflows: string[];
  activeQueues: string[];
  connectedProviders: string[];
  systemHealthScore: number;
  timestamp: Date;
}

export interface BudgetUsage {
  providerName: string;      // e.g., "OpenAI", "Claude", "Gemini", "Runway", "Kling", "ElevenLabs", "Storage", "GPU", "Rendering", "Publishing"
  usedUsd: number;
  totalCalls: number;
  lastCallAt: Date;
}

export interface BudgetLimit {
  providerName: string;
  limitUsd: number;
  alertThresholdPercent: number;  // e.g., 80 for 80%
  active: boolean;
}

export interface BudgetReport {
  id: string;
  state: BudgetState;
  usages: BudgetUsage[];
  limits: BudgetLimit[];
  totalBudgetLimitUsd: number;
  totalBudgetUsedUsd: number;
  generatedAt: Date;
}

export interface ExecutionLock {
  id: string;
  workflowId: string;
  lockedBy: string;
  reason: string;
  createdAt: Date;
  expiresAt?: Date;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  priority: NotificationPriority;
  category: string;  // e.g. "BUDGET", "EMERGENCY", "APPROVAL", "EXECUTION"
  read: boolean;
  createdAt: Date;
}

export interface NotificationGroup {
  id: string;
  category: string;
  notifications: Notification[];
  unreadCount: number;
  lastUpdatedAt: Date;
}

export interface ControlTimelineEvent {
  id: string;
  action: ControlAction;
  targetId: string;
  status: "STARTED" | "COMPLETED" | "FAILED" | "PAUSED" | "RESUMED";
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface ControlTimeline {
  id: string;
  events: ControlTimelineEvent[];
  startedAt: Date;
  updatedAt: Date;
}

export interface ControlHistoryEntry {
  id: string;
  request: ControlRequest;
  response: ControlResponse;
  timestamp: Date;
}

export interface ControlHistory {
  id: string;
  entries: ControlHistoryEntry[];
  totalActions: number;
  failedActions: number;
}

export interface TaskStatus {
  taskId: string;
  name: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "PAUSED";
  startedAt?: Date;
  completedAt?: Date;
}

export interface EngineStatus {
  engineKey: string;
  state: string;
  healthy: boolean;
  currentTask?: string;
  lastUpdated: Date;
}

export interface WorkflowStatus {
  workflowId: string;
  name: string;
  state: "IDLE" | "RUNNING" | "PAUSED" | "STOPPED" | "FAILED" | "COMPLETED";
  currentStage: string;
  stages: string[];
  tasks: TaskStatus[];
  engineStatuses: EngineStatus[];
  startedAt?: Date;
  updatedAt: Date;
}

export interface FounderDecision {
  decisionId: string;
  action: string;
  overrideApplied: boolean;
  approved: boolean;
  timestamp: Date;
  reason?: string;
}

export interface ApprovalRequest {
  id: string;
  title: string;
  description: string;
  costEstimateUsd?: number;
  category: "PUBLISHING" | "RENDERING" | "GENERATION" | "DELETE_ASSET" | "DELETE_MEMORY" | "SYSTEM_UPDATE";
  requestedBy: string;
  requestedAt: Date;
  status: "PENDING" | "APPROVED" | "REJECTED";
  decidedAt?: Date;
  decidedBy?: string;
  rejectionReason?: string;
}

export interface PendingApproval {
  request: ApprovalRequest;
  expiresAt?: Date;
  lockId?: string; // lock execution until approved/rejected
}

export interface ControlMetrics {
  totalOverridesCount: number;
  activeApprovalsCount: number;
  totalBudgetsCount: number;
  activeLocksCount: number;
  recoveryCount: number;
  activeEmergenciesCount: number;
}

export interface ControlReport {
  id: string;
  metrics: ControlMetrics;
  history: ControlHistory;
  budgetReport: BudgetReport;
  timestamp: Date;
}

export interface ControlSnapshot {
  id: string;
  state: ControlCenterState;
  activeOverrides: ManualOverride[];
  pendingApprovals: PendingApproval[];
  activeLocks: ExecutionLock[];
  emergencies: EmergencyStop[];
  budgetState: BudgetState;
  timestamp: Date;
}
