import { ControlCenterState }    from "./ControlCenterState";
import { OverrideType }          from "./OverrideType";
import { EmergencyLevel }        from "./EmergencyLevel";
import { BudgetState }           from "./BudgetState";
import { NotificationPriority }  from "./NotificationPriority";
import { ExecutionPermission }   from "./ExecutionPermission";
import { ControlAction }         from "./ControlAction";
import { deepFreeze }           from "./types";
import { ControlCenterValidator } from "./ControlCenterValidator";
import type {
  IControlCenterEngine,
  IManualOverrideManager,
  IBudgetManager,
  IEmergencyManager,
  INotificationManager,
  IApprovalManager,
  IPermissionManager,
  IExecutionController,
} from "./interfaces";
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
  ControlTimelineEvent,
  ControlHistory,
  ControlHistoryEntry,
  WorkflowStatus,
  PendingApproval,
  ApprovalRequest,
  ControlMetrics,
  ControlReport,
  ControlSnapshot,
} from "./models";

// ─── Default Sub-Managers ─────────────────────────────────────────────────────

class DefaultManualOverrideManager implements IManualOverrideManager {
  private _overrides = new Map<string, ManualOverride>();

  applyOverride(override: ManualOverride): void {
    ControlCenterValidator.validateNoDuplicateOverrides([...this._overrides.values(), override]);
    this._overrides.set(override.id, override);
  }

  removeOverride(overrideId: string): void {
    this._overrides.delete(overrideId);
  }

  getOverride(overrideId: string): ManualOverride | undefined {
    return this._overrides.get(overrideId);
  }

  getActiveOverrides(workflowId?: string): ManualOverride[] {
    const list = [...this._overrides.values()].filter(o => o.active);
    return workflowId ? list.filter(o => o.workflowId === workflowId) : list;
  }
}

class DefaultBudgetManager implements IBudgetManager {
  private _limits = new Map<string, BudgetLimit>();
  private _usages = new Map<string, BudgetUsage>();

  constructor() {
    // Populate default providers from the prompt list
    const providers = ["OpenAI", "Claude", "Gemini", "Runway", "Kling", "ElevenLabs", "Storage", "GPU", "Rendering", "Publishing"];
    for (const p of providers) {
      this._limits.set(p, { providerName: p, limitUsd: 100, alertThresholdPercent: 80, active: true });
      this._usages.set(p, { providerName: p, usedUsd: 0, totalCalls: 0, lastCallAt: new Date() });
    }
  }

  setLimit(limit: BudgetLimit): void {
    ControlCenterValidator.validateBudgetLimit(limit);
    this._limits.set(limit.providerName, limit);
  }

  recordUsage(providerName: string, usedUsd: number): BudgetState {
    const usage = this._usages.get(providerName) ?? { providerName, usedUsd: 0, totalCalls: 0, lastCallAt: new Date() };
    usage.usedUsd += usedUsd;
    usage.totalCalls++;
    usage.lastCallAt = new Date();
    this._usages.set(providerName, usage);

    const limit = this._limits.get(providerName);
    ControlCenterValidator.validateBudgetUsage(usage, limit);

    if (!limit || !limit.active) return BudgetState.NORMAL;

    const percent = (usage.usedUsd / limit.limitUsd) * 100;
    if (percent >= 100) return BudgetState.LIMIT_REACHED;
    if (percent >= limit.alertThresholdPercent) return BudgetState.WARNING;
    return BudgetState.NORMAL;
  }

  getUsage(providerName: string): BudgetUsage | undefined {
    return this._usages.get(providerName);
  }

  getReport(): BudgetReport {
    const usages = [...this._usages.values()];
    const limits = [...this._limits.values()];
    const totalBudgetLimitUsd = limits.reduce((sum, l) => sum + (l.active ? l.limitUsd : 0), 0);
    const totalBudgetUsedUsd = usages.reduce((sum, u) => sum + u.usedUsd, 0);

    let state = BudgetState.NORMAL;
    if (totalBudgetUsedUsd >= totalBudgetLimitUsd) {
      state = BudgetState.LIMIT_REACHED;
    } else if (totalBudgetUsedUsd >= totalBudgetLimitUsd * 0.8) {
      state = BudgetState.WARNING;
    }

    return {
      id: `breport-${Date.now()}`,
      state,
      usages,
      limits,
      totalBudgetLimitUsd,
      totalBudgetUsedUsd,
      generatedAt: new Date(),
    };
  }

  resetUsages(): void {
    for (const key of this._usages.keys()) {
      const usage = this._usages.get(key)!;
      usage.usedUsd = 0;
      usage.totalCalls = 0;
      usage.lastCallAt = new Date();
    }
  }
}

class DefaultEmergencyManager implements IEmergencyManager {
  private _stops = new Map<string, EmergencyStop>();
  private _snapshots = new Map<string, EmergencySnapshot>();

  trigger(level: EmergencyLevel, reason: string, triggeredBy: string): EmergencyStop {
    const id = `estop-${Date.now()}`;
    const snapId = `esnap-${Date.now()}`;
    const stop: EmergencyStop = {
      id, level, reason, triggeredBy, triggeredAt: new Date(), active: true, snapshotId: snapId,
    };

    const snapshot: EmergencySnapshot = {
      id: snapId, stopId: id,
      runningWorkflows: ["researchWorkflow-01"],
      activeQueues: ["publishingQueue"],
      connectedProviders: ["youtube"],
      systemHealthScore: 80,
      timestamp: new Date(),
    };

    this._stops.set(id, stop);
    this._snapshots.set(snapId, snapshot);
    return stop;
  }

  recover(stopId: string, recoveredBy: string): void {
    const stop = this._stops.get(stopId);
    if (stop) {
      const snapshot = this._snapshots.get(stop.snapshotId ?? "");
      ControlCenterValidator.validateEmergencyRecovery(stopId, snapshot);
      if (snapshot) {
        ControlCenterValidator.validateRecoverySnapshotIntegrity(snapshot);
      }
      stop.active = false;
    }
  }

  getActiveStops(): EmergencyStop[] {
    return [...this._stops.values()].filter(s => s.active);
  }

  getSnapshot(snapshotId: string): EmergencySnapshot | undefined {
    return this._snapshots.get(snapshotId);
  }
}

class DefaultNotificationManager implements INotificationManager {
  private _notifications: Notification[] = [];

  createNotification(
    priority: NotificationPriority,
    title: string,
    message: string,
    category: string
  ): Notification {
    ControlCenterValidator.validateNotificationPriority(priority);
    const n: Notification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title, message, priority, category, read: false, createdAt: new Date(),
    };
    ControlCenterValidator.validateNoDuplicateNotifications([...this._notifications, n]);
    this._notifications.push(n);
    return n;
  }

  markRead(notificationId: string): void {
    const n = this._notifications.find(item => item.id === notificationId);
    if (n) n.read = true;
  }

  getUnread(category?: string): Notification[] {
    const list = this._notifications.filter(n => !n.read);
    return category ? list.filter(n => n.category === category) : list;
  }

  getGrouped(): NotificationGroup[] {
    const map = new Map<string, Notification[]>();
    for (const n of this._notifications) {
      const list = map.get(n.category) ?? [];
      list.push(n);
      map.set(n.category, list);
    }
    return [...map.entries()].map(([cat, list]) => ({
      id: `group-${cat}-${Date.now()}`,
      category: cat,
      notifications: list,
      unreadCount: list.filter(n => !n.read).length,
      lastUpdatedAt: list[list.length - 1]?.createdAt ?? new Date(),
    }));
  }

  getHistory(limit = 100): Notification[] {
    return [...this._notifications].reverse().slice(0, limit);
  }
}

class DefaultApprovalManager implements IApprovalManager {
  private _requests = new Map<string, ApprovalRequest>();

  requestApproval(request: ApprovalRequest): PendingApproval {
    ControlCenterValidator.validateApprovalRequest(request);
    this._requests.set(request.id, request);
    return {
      request,
      expiresAt: new Date(Date.now() + 3600_000),
      lockId: `lock-${request.id}`,
    };
  }

  grantApproval(requestId: string, approvedBy: string): void {
    const req = this._requests.get(requestId);
    if (req) {
      req.status = "APPROVED";
      req.decidedAt = new Date();
      req.decidedBy = approvedBy;
    }
  }

  rejectApproval(requestId: string, rejectedBy: string, reason: string): void {
    const req = this._requests.get(requestId);
    if (req) {
      req.status = "REJECTED";
      req.decidedAt = new Date();
      req.decidedBy = rejectedBy;
      req.rejectionReason = reason;
    }
  }

  getPending(): PendingApproval[] {
    return [...this._requests.values()]
      .filter(r => r.status === "PENDING")
      .map(request => ({
        request, expiresAt: new Date(Date.now() + 3600_000), lockId: `lock-${request.id}`,
      }));
  }

  getRequest(requestId: string): ApprovalRequest | undefined {
    return this._requests.get(requestId);
  }
}

class DefaultPermissionManager implements IPermissionManager {
  private _rules = new Map<string, ExecutionPermissionRule>();

  setRule(rule: ExecutionPermissionRule): void {
    ControlCenterValidator.validatePermissionRule(rule);
    this._rules.set(`${rule.workflowId}-${rule.action}`, rule);
  }

  checkPermission(workflowId: string, action: ControlAction): ExecutionPermission {
    const rule = this._rules.get(`${workflowId}-${action}`);
    if (!rule) return ExecutionPermission.ALLOW; // default
    if (rule.expiresAt && rule.expiresAt < new Date()) {
      return ExecutionPermission.ALLOW;
    }
    return rule.permission;
  }

  getRules(workflowId?: string): ExecutionPermissionRule[] {
    const all = [...this._rules.values()];
    return workflowId ? all.filter(r => r.workflowId === workflowId) : all;
  }
}

class DefaultExecutionController implements IExecutionController {
  private _locks = new Map<string, ExecutionLock>();
  private _timelineEvents: ControlTimelineEvent[] = [];

  acquireLock(workflowId: string, lockedBy: string, reason: string, expiresMs = 300_000): ExecutionLock {
    const activeLocks = [...this._locks.values()];
    const lockId = `lock-${workflowId}-${Date.now()}`;
    const newLock: ExecutionLock = { id: lockId, workflowId, lockedBy, reason, createdAt: new Date(), expiresAt: new Date(Date.now() + expiresMs) };

    ControlCenterValidator.validateNoDuplicateWorkflowLocks([...activeLocks, newLock]);
    this._locks.set(lockId, newLock);
    return newLock;
  }

  releaseLock(lockId: string): void {
    this._locks.delete(lockId);
  }

  getLocks(): ExecutionLock[] {
    return [...this._locks.values()].filter(l => !l.expiresAt || l.expiresAt > new Date());
  }

  isLocked(workflowId: string): boolean {
    return this.getLocks().some(l => l.workflowId === workflowId);
  }

  async rollback(workflowId: string, targetStage: string): Promise<void> {
    ControlCenterValidator.validateRollbackTarget(targetStage);
    this._timelineEvents.push({
      id: `ev-${Date.now()}`, action: ControlAction.ROLLBACK, targetId: workflowId,
      status: "COMPLETED", timestamp: new Date(), metadata: { targetStage },
    });
  }

  async restart(workflowId: string, checkpointName: string): Promise<void> {
    ControlCenterValidator.validateRestartCheckpoint(checkpointName);
    this._timelineEvents.push({
      id: `ev-${Date.now()}`, action: ControlAction.RESTART, targetId: workflowId,
      status: "COMPLETED", timestamp: new Date(), metadata: { checkpointName },
    });
  }

  getTimelineEvents(): ControlTimelineEvent[] {
    return [...this._timelineEvents];
  }
}

// ─── Control Center Engine Orchestrator ───────────────────────────────────────

export class ControlCenterEngine implements IControlCenterEngine {
  private _state: ControlCenterState = ControlCenterState.CREATED;
  private _timeline: ControlTimelineEvent[] = [];
  private _history: ControlHistoryEntry[] = [];

  constructor(
    public readonly context: any,
    private readonly _overrideMgr: IManualOverrideManager = new DefaultManualOverrideManager(),
    private readonly _budgetMgr: IBudgetManager = new DefaultBudgetManager(),
    private readonly _emergencyMgr: IEmergencyManager = new DefaultEmergencyManager(),
    private readonly _notificationMgr: INotificationManager = new DefaultNotificationManager(),
    private readonly _approvalMgr: IApprovalManager = new DefaultApprovalManager(),
    private readonly _permissionMgr: IPermissionManager = new DefaultPermissionManager(),
    private readonly _executionCtrl: IExecutionController = new DefaultExecutionController(),
    public readonly metadata: Record<string, unknown> = {}
  ) {}

  public async initialize(): Promise<void> {
    ControlCenterValidator.validateStateTransition("ControlCenterEngine", this._state, ControlCenterState.INITIALIZED);
    this._state = ControlCenterState.INITIALIZED;
    await this._emit("ControlStarted", { state: this._state });
  }

  public async start(): Promise<void> {
    ControlCenterValidator.validateStateTransition("ControlCenterEngine", this._state, ControlCenterState.MONITORING);
    this._state = ControlCenterState.MONITORING;
  }

  public async stop(): Promise<void> {
    ControlCenterValidator.validateStateTransition("ControlCenterEngine", this._state, ControlCenterState.FAILED);
    this._state = ControlCenterState.FAILED;
  }

  public async pause(): Promise<void> {
    ControlCenterValidator.validateStateTransition("ControlCenterEngine", this._state, ControlCenterState.PAUSED);
    this._state = ControlCenterState.PAUSED;
  }

  public async resume(): Promise<void> {
    ControlCenterValidator.validateStateTransition("ControlCenterEngine", this._state, ControlCenterState.ACTIVE);
    this._state = ControlCenterState.ACTIVE;
  }

  get state(): ControlCenterState {
    return this._state;
  }

  public getOverrideManager(): IManualOverrideManager { return this._overrideMgr; }
  public getBudgetManager(): IBudgetManager { return this._budgetMgr; }
  public getEmergencyManager(): IEmergencyManager { return this._emergencyMgr; }
  public getNotificationManager(): INotificationManager { return this._notificationMgr; }
  public getApprovalManager(): IApprovalManager { return this._approvalMgr; }
  public getPermissionManager(): IPermissionManager { return this._permissionMgr; }
  public getExecutionController(): IExecutionController { return this._executionCtrl; }

  // ─── Command Execution ──────────────────────────────────────────────────────

  public async execute(request: ControlRequest): Promise<ControlResponse> {
    ControlCenterValidator.validateControlRequest(request);

    // Validate execution action mapping against allowed actions
    const allowedActions = [
      ControlAction.START, ControlAction.STOP, ControlAction.PAUSE,
      ControlAction.RESUME, ControlAction.RESTART, ControlAction.SKIP,
      ControlAction.RETRY, ControlAction.ROLLBACK,
    ];
    ControlCenterValidator.validateExecutionAction(request.action, allowedActions);

    const eventId = `timeline-evt-${Date.now()}`;
    const newEvent: ControlTimelineEvent = {
      id: eventId, action: request.action, targetId: request.targetWorkflowId ?? "all",
      status: "STARTED", timestamp: new Date(),
    };
    this._timeline.push(newEvent);
    ControlCenterValidator.validateTimelineOrder(this._timeline);

    let success = true;
    let errorMessage: string | undefined;

    try {
      switch (request.action) {
        case ControlAction.PAUSE:
          if (request.targetWorkflowId) {
            this._executionCtrl.acquireLock(request.targetWorkflowId, "ControlCenter", "Paused manually");
          }
          await this._emit("WorkflowPaused", { workflowId: request.targetWorkflowId });
          break;

        case ControlAction.RESUME:
          if (request.targetWorkflowId) {
            const lock = this._executionCtrl.getLocks().find(l => l.workflowId === request.targetWorkflowId);
            if (lock) this._executionCtrl.releaseLock(lock.id);
          }
          await this._emit("WorkflowResumed", { workflowId: request.targetWorkflowId });
          break;

        case ControlAction.STOP:
          if (request.targetWorkflowId) {
            this._executionCtrl.acquireLock(request.targetWorkflowId, "ControlCenter", "Stopped manually");
          }
          break;

        case ControlAction.ROLLBACK:
          if (request.targetWorkflowId && request.targetStage) {
            await this._executionCtrl.rollback(request.targetWorkflowId, request.targetStage);
            await this._emit("ExecutionRolledBack", { workflowId: request.targetWorkflowId, targetStage: request.targetStage });
          }
          break;

        case ControlAction.RESTART:
          if (request.targetWorkflowId && request.targetStage) {
            await this._executionCtrl.restart(request.targetWorkflowId, request.targetStage);
            await this._emit("ExecutionRestarted", { workflowId: request.targetWorkflowId, checkpoint: request.targetStage });
          }
          break;
      }
    } catch (e: any) {
      success = false;
      errorMessage = e.message;
    }

    const response: ControlResponse = {
      id: `cresp-${Date.now()}`,
      requestId: request.id,
      success,
      state: this._state,
      snapshot: this.getSnapshot(),
      errorMessage,
      timestamp: new Date(),
    };

    // Save history
    this._history.push({ id: `chist-${Date.now()}`, request, response, timestamp: new Date() });

    // Memory save
    const ctx = this.context;
    if (ctx?.memoryStore) {
      const activeOverrides = this._overrideMgr.getActiveOverrides();
      const pendingApprovals = this._approvalMgr.getPending();
      const budgetReport = this._budgetMgr.getReport();
      const unreadNotifications = this._notificationMgr.getUnread();
      const rules = this._permissionMgr.getRules();
      const activeStops = this._emergencyMgr.getActiveStops();
      const locks = this._executionCtrl.getLocks();

      await ctx.memoryStore.set("control-center",      `state:${request.id}`, this._state);
      await ctx.memoryStore.set("manual-overrides",    `overrides:${request.id}`, activeOverrides.map(o => o.id));
      await ctx.memoryStore.set("approvals",           `approvals:${request.id}`, pendingApprovals.map(a => a.request.id));
      await ctx.memoryStore.set("budget",              `report:${request.id}`, budgetReport.totalBudgetUsedUsd);
      await ctx.memoryStore.set("notifications",       `unread:${request.id}`, unreadNotifications.length);
      await ctx.memoryStore.set("permissions",         `rules:${request.id}`, rules.length);
      await ctx.memoryStore.set("emergency",           `stops:${request.id}`, activeStops.length);
      await ctx.memoryStore.set("execution-history",   `timeline:${request.id}`, this._timeline.length);
      await ctx.memoryStore.set("workflow-locks",      `locks:${request.id}`, locks.map(l => l.id));
    }

    // Integrations: Decision + Planning Feedback
    if (ctx?.decisionEngine?.record) {
      await ctx.decisionEngine.record({
        controlCenterRequestId: request.id,
        action: request.action,
        success,
        state: this._state,
      });
    }

    if (ctx?.planningEngine?.createTask) {
      await ctx.planningEngine.createTask({
        type: "CONTROL_CENTER_ACTION_COMPLETE",
        action: request.action,
        requestId: request.id,
        success,
      });
    }

    return response;
  }

  // ─── Snapshots ──────────────────────────────────────────────────────────────

  public getSnapshot(): ControlSnapshot {
    const snap: ControlSnapshot = {
      id: `csnap-${Date.now()}`,
      state: this._state,
      activeOverrides: this._overrideMgr.getActiveOverrides(),
      pendingApprovals: this._approvalMgr.getPending(),
      activeLocks: this._executionCtrl.getLocks(),
      emergencies: this._emergencyMgr.getActiveStops(),
      budgetState: this._budgetMgr.getReport().state,
      timestamp: new Date(),
    };
    const frozen = deepFreeze(snap);
    ControlCenterValidator.validateSnapshotImmutability(frozen);
    return frozen;
  }

  public getReport(): ControlReport {
    const activeOverrides = this._overrideMgr.getActiveOverrides();
    const pendingApprovals = this._approvalMgr.getPending();
    const activeLocks = this._executionCtrl.getLocks();
    const activeStops = this._emergencyMgr.getActiveStops();

    const metrics: ControlMetrics = {
      totalOverridesCount: activeOverrides.length,
      activeApprovalsCount: pendingApprovals.length,
      totalBudgetsCount: 10,
      activeLocksCount: activeLocks.length,
      recoveryCount: 0,
      activeEmergenciesCount: activeStops.length,
    };

    const history: ControlHistory = {
      id: `chist-${Date.now()}`,
      entries: this._history,
      totalActions: this._history.length,
      failedActions: this._history.filter(h => !h.response.success).length,
    };

    return {
      id: `creport-${Date.now()}`,
      metrics,
      history,
      budgetReport: this._budgetMgr.getReport(),
      timestamp: new Date(),
    };
  }

  // ─── Helper Event Emitter ───────────────────────────────────────────────────

  private async _emit(name: string, payload: Record<string, unknown>): Promise<void> {
    if (this.context?.eventBus?.publish) {
      try {
        await this.context.eventBus.publish({
          id: `evt-${name.toLowerCase()}-${Math.random().toString(36).slice(2, 7)}`,
          name,
          timestamp: new Date(),
          source: "ControlCenterEngine",
          payload,
          metadata: {},
        });
      } catch (_) {}
    }
  }
}
