import { ControlCenterState }    from "./ControlCenterState";
import { OverrideType }          from "./OverrideType";
import { EmergencyLevel }        from "./EmergencyLevel";
import { BudgetState }           from "./BudgetState";
import { NotificationPriority }  from "./NotificationPriority";
import { ExecutionPermission }   from "./ExecutionPermission";
import { ControlAction }         from "./ControlAction";
import type {
  ControlRequest,
  ControlResponse,
  ManualOverride,
  ExecutionPermissionRule,
  EmergencyStop,
  EmergencySnapshot,
  BudgetUsage,
  BudgetLimit,
  BudgetReport,
  ExecutionLock,
  Notification,
  NotificationGroup,
  ControlTimeline,
  ControlHistory,
  WorkflowStatus,
  PendingApproval,
  ApprovalRequest,
  ControlMetrics,
  ControlReport,
  ControlSnapshot,
} from "./models";

// ─── Control Center Engine ───────────────────────────────────────────────────

export interface IControlCenterEngine {
  readonly state: ControlCenterState;

  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;

  /** Execute a manual/automated control request */
  execute(request: ControlRequest): Promise<ControlResponse>;

  /** Retrieve the latest snapshot of control center state */
  getSnapshot(): ControlSnapshot;

  /** Get complete health/metrics control center report */
  getReport(): ControlReport;

  // Exposure of sub-managers
  getOverrideManager(): IManualOverrideManager;
  getBudgetManager(): IBudgetManager;
  getEmergencyManager(): IEmergencyManager;
  getNotificationManager(): INotificationManager;
  getApprovalManager(): IApprovalManager;
  getPermissionManager(): IPermissionManager;
  getExecutionController(): IExecutionController;
}

// ─── Manual Override Manager ─────────────────────────────────────────────────

export interface IManualOverrideManager {
  applyOverride(override: ManualOverride): void;
  removeOverride(overrideId: string): void;
  getOverride(overrideId: string): ManualOverride | undefined;
  getActiveOverrides(workflowId?: string): ManualOverride[];
}

// ─── Budget Manager ──────────────────────────────────────────────────────────

export interface IBudgetManager {
  setLimit(limit: BudgetLimit): void;
  recordUsage(providerName: string, usedUsd: number): BudgetState;
  getUsage(providerName: string): BudgetUsage | undefined;
  getReport(): BudgetReport;
  resetUsages(): void;
}

// ─── Emergency Manager ────────────────────────────────────────────────────────

export interface IEmergencyManager {
  trigger(level: EmergencyLevel, reason: string, triggeredBy: string): EmergencyStop;
  recover(stopId: string, recoveredBy: string): void;
  getActiveStops(): EmergencyStop[];
  getSnapshot(snapshotId: string): EmergencySnapshot | undefined;
}

// ─── Notification Manager ─────────────────────────────────────────────────────

export interface INotificationManager {
  createNotification(
    priority: NotificationPriority,
    title: string,
    message: string,
    category: string
  ): Notification;
  markRead(notificationId: string): void;
  getUnread(category?: string): Notification[];
  getGrouped(): NotificationGroup[];
  getHistory(limit?: number): Notification[];
}

// ─── Approval Manager ─────────────────────────────────────────────────────────

export interface IApprovalManager {
  requestApproval(request: ApprovalRequest): PendingApproval;
  grantApproval(requestId: string, approvedBy: string): void;
  rejectApproval(requestId: string, rejectedBy: string, reason: string): void;
  getPending(): PendingApproval[];
  getRequest(requestId: string): ApprovalRequest | undefined;
}

// ─── Permission Manager ───────────────────────────────────────────────────────

export interface IPermissionManager {
  setRule(rule: ExecutionPermissionRule): void;
  checkPermission(workflowId: string, action: ControlAction): ExecutionPermission;
  getRules(workflowId?: string): ExecutionPermissionRule[];
}

// ─── Execution Controller ─────────────────────────────────────────────────────

export interface IExecutionController {
  acquireLock(workflowId: string, lockedBy: string, reason: string, expiresMs?: number): ExecutionLock;
  releaseLock(lockId: string): void;
  getLocks(): ExecutionLock[];
  isLocked(workflowId: string): boolean;
  rollback(workflowId: string, targetStage: string): Promise<void>;
  restart(workflowId: string, checkpointName: string): Promise<void>;
}
