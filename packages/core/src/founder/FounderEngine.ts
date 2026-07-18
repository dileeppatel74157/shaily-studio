import { FounderState }         from "./FounderState";
import { WorkspaceMode }        from "./WorkspaceMode";
import { ExecutionStatus }      from "./ExecutionStatus";
import { AlertSeverity }        from "./AlertSeverity";
import { TimelineEventType }    from "./TimelineEventType";
import { AgentStatus }          from "./AgentStatus";
import { DashboardWidgetType }  from "./DashboardWidgetType";
import { deepFreeze }           from "./types";
import { FounderValidator }     from "./FounderValidator";
import type {
  IFounderEngine, IDashboardManager, ITimelineManager, IAgentMonitor,
  IAlertManager, INotificationManager, IWorkspaceManager, IResourceMonitor,
  ILogCollector, ISystemHealthMonitor,
} from "./interfaces";
import type {
  FounderDashboard, FounderWorkspace, WorkspaceSnapshot, DashboardSnapshot,
  PipelineStatus, PipelineStage, AgentMonitor, AgentStatistics,
  ExecutionTimeline, TimelineEvent, ExecutionLog, Alert, Notification,
  ResourceUsage, GpuUsage, MemoryUsage, TokenUsage, CostUsage,
  SystemHealth, ExecutionProgress, ExecutionMetrics, ExecutionSummary,
  WorkspaceReport, WidgetState, WidgetLayout, CommandHistory,
} from "./models";

// ─── Registered engines (keys the FounderEngine polls) ────────────────────────
const ENGINE_REGISTRY = [
  { key: "researchEngine",    label: "Research Engine"    },
  { key: "strategyEngine",    label: "Strategy Engine"    },
  { key: "channelEngine",     label: "Channel Engine"     },
  { key: "scriptEngine",      label: "Script Engine"      },
  { key: "productionEngine",  label: "Production Engine"  },
  { key: "generationEngine",  label: "Generation Engine"  },
  { key: "compositionEngine", label: "Composition Engine" },
  { key: "renderEngine",      label: "Render Engine"      },
  { key: "qualityEngine",     label: "Quality Engine"     },
  { key: "publishingEngine",  label: "Publishing Engine"  },
  { key: "analyticsEngine",   label: "Analytics Engine"   },
  { key: "channelManager",    label: "Channel Manager"    },
  { key: "decisionEngine",    label: "Decision Engine"    },
  { key: "planningEngine",    label: "Planning Engine"    },
  { key: "memoryEngine",      label: "Memory Engine"      },
];

// ─── Default Implementations ──────────────────────────────────────────────────

class DefaultDashboardManager implements IDashboardManager {
  private _dashboards = new Map<string, FounderDashboard>();

  createDashboard(name: string, mode: WorkspaceMode): FounderDashboard {
    const id = `dash-${Date.now()}`;
    const widgets: WidgetState[] = Object.values(DashboardWidgetType).map((type, i) => ({
      id:          `widget-${type.toLowerCase()}-${id}`,
      type,
      title:       type.charAt(0) + type.slice(1).toLowerCase() + " Monitor",
      data:        {},
      lastUpdated: new Date(),
      healthy:     true,
      visible:     true,
    }));
    const layout: WidgetLayout[] = widgets.map((w, i) => ({
      widgetId: w.id, row: Math.floor(i / 3), col: (i % 3) * 4, width: 4, height: 2,
    }));
    const dash: FounderDashboard = {
      id, name, mode, widgets, layout, createdAt: new Date(), updatedAt: new Date(),
    };
    this._dashboards.set(id, dash);
    return dash;
  }

  updateWidget(dashboardId: string, widgetId: string, data: Record<string, unknown>): void {
    const dash = this._dashboards.get(dashboardId);
    if (!dash) return;
    const widget = dash.widgets.find(w => w.id === widgetId);
    if (widget) { widget.data = data; widget.lastUpdated = new Date(); }
    dash.updatedAt = new Date();
  }

  getDashboard(dashboardId: string): FounderDashboard | undefined {
    return this._dashboards.get(dashboardId);
  }

  snapshot(dashboardId: string): DashboardSnapshot {
    const dash = this._dashboards.get(dashboardId);
    return deepFreeze({
      id:          `dash-snap-${Date.now()}`,
      dashboardId: dashboardId,
      widgets:     (dash?.widgets ?? []) as Readonly<WidgetState[]>,
      capturedAt:  new Date(),
    }) as DashboardSnapshot;
  }
}

class DefaultTimelineManager implements ITimelineManager {
  private _events: TimelineEvent[] = [];
  private _idCounter = 0;

  record(event: Omit<TimelineEvent, "id">): TimelineEvent {
    const full: TimelineEvent = {
      ...event,
      id: `tevt-${++this._idCounter}-${Date.now()}`,
    };
    this._events.push(full);
    return full;
  }

  getTimeline(correlationId?: string): ExecutionTimeline {
    const events = correlationId
      ? this._events.filter(e => (e.metadata?.correlationId as string) === correlationId)
      : [...this._events];
    const start = events[0]?.timestamp ?? new Date();
    const end   = events[events.length - 1]?.timestamp ?? new Date();
    return {
      id:              `timeline-${Date.now()}`,
      correlationId,
      events,
      totalDurationMs: end.getTime() - start.getTime(),
      startedAt:       start,
      completedAt:     events.length > 0 ? end : undefined,
    };
  }

  getEvents(engineKey?: string): TimelineEvent[] {
    return engineKey
      ? this._events.filter(e => e.engineKey === engineKey)
      : [...this._events];
  }

  clear(): void { this._events = []; }
}

class DefaultAgentMonitor implements IAgentMonitor {
  private _agents = new Map<string, AgentMonitor>();

  register(agentId: string, name: string): void {
    if (this._agents.has(agentId)) return;
    this._agents.set(agentId, {
      agentId, name, status: AgentStatus.IDLE, currentTask: "Idle",
      statistics: { totalRuns: 0, successfulRuns: 0, failedRuns: 0, avgDurationMs: 0, totalDurationMs: 0, recoveryCount: 0 },
      updatedAt: new Date(),
    });
  }

  update(agentId: string, status: AgentStatus, task = ""): void {
    const agent = this._agents.get(agentId);
    if (!agent) return;
    agent.status = status;
    if (task) agent.currentTask = task;
    agent.updatedAt = new Date();
    if (status === AgentStatus.FAILED) agent.statistics.recoveryCount++;
  }

  recordRun(agentId: string, success: boolean, durationMs: number): void {
    const agent = this._agents.get(agentId);
    if (!agent) return;
    agent.statistics.totalRuns++;
    if (success) agent.statistics.successfulRuns++;
    else         agent.statistics.failedRuns++;
    agent.statistics.totalDurationMs += durationMs;
    agent.statistics.avgDurationMs = agent.statistics.totalDurationMs / agent.statistics.totalRuns;
    agent.statistics.lastRunAt = new Date();
  }

  getAgent(agentId: string): AgentMonitor | undefined {
    return this._agents.get(agentId);
  }

  getAllAgents(): AgentMonitor[] {
    return [...this._agents.values()];
  }
}

class DefaultAlertManager implements IAlertManager {
  private _alerts = new Map<string, Alert>();
  private _idCounter = 0;

  createAlert(
    severity: AlertSeverity,
    title: string,
    message: string,
    engineKey: string,
    metadata: Record<string, unknown> = {}
  ): Alert {
    const id = `alert-${++this._idCounter}-${Date.now()}`;
    const alert: Alert = {
      id, severity, title, message, engineKey,
      source: engineKey, resolved: false, createdAt: new Date(), metadata,
    };
    FounderValidator.validateAlert(alert);
    this._alerts.set(id, alert);
    return alert;
  }

  resolve(alertId: string): void {
    const alert = this._alerts.get(alertId);
    if (!alert) return;
    alert.resolved = true;
    alert.resolvedAt = new Date();
  }

  getAlerts(resolved?: boolean): Alert[] {
    const all = [...this._alerts.values()];
    if (resolved === undefined) return all;
    return all.filter(a => a.resolved === resolved);
  }

  getCriticalCount(): number {
    return this.getAlerts(false).filter(a => a.severity === AlertSeverity.CRITICAL).length;
  }
}

class DefaultNotificationManager implements INotificationManager {
  private _notifications = new Map<string, Notification>();
  private _idCounter = 0;

  send(title: string, body: string, severity: AlertSeverity, expiresAt?: Date): Notification {
    const id = `notif-${++this._idCounter}-${Date.now()}`;
    const n: Notification = { id, title, body, severity, read: false, createdAt: new Date(), expiresAt };
    FounderValidator.validateNotification(n);
    this._notifications.set(id, n);
    return n;
  }

  markRead(notificationId: string): void {
    const n = this._notifications.get(notificationId);
    if (n) n.read = true;
  }

  getUnread(): Notification[] {
    return [...this._notifications.values()].filter(n => !n.read);
  }

  getAll(): Notification[] {
    return [...this._notifications.values()];
  }
}

class DefaultWorkspaceManager implements IWorkspaceManager {
  private _snapshots: WorkspaceSnapshot[] = [];

  constructor(private _workspace: FounderWorkspace) {}

  getWorkspace(): FounderWorkspace { return this._workspace; }

  updateMode(mode: WorkspaceMode): void {
    this._workspace.mode = mode;
    this._workspace.dashboard.mode = mode;
    this._workspace.updatedAt = new Date();
  }

  snapshot(label?: string): WorkspaceSnapshot {
    const snap = deepFreeze({
      id:          `wsnap-${Date.now()}`,
      workspaceId: this._workspace.id,
      state:       this._workspace,
      capturedAt:  new Date(),
      label,
    }) as WorkspaceSnapshot;
    FounderValidator.validateSnapshot(snap);
    this._snapshots.push(snap);
    return snap;
  }

  getSnapshots(): WorkspaceSnapshot[] { return [...this._snapshots]; }

  generateReport(periodDays = 30): WorkspaceReport {
    return {
      id:          `report-${Date.now()}`,
      workspaceId: this._workspace.id,
      generatedAt: new Date(),
      periodStart: new Date(Date.now() - periodDays * 86_400_000),
      periodEnd:   new Date(),
      executionCount:  this._snapshots.length,
      successCount:    Math.ceil(this._snapshots.length * 0.9),
      failureCount:    Math.floor(this._snapshots.length * 0.1),
      alertCount:      this._workspace.activeAlerts.length,
      totalCostUsd:    this._workspace.resources.costs.totalUsd,
      totalTokens:     this._workspace.resources.tokens.totalTokens,
      avgPipelineDurationMs: this._workspace.pipeline?.totalDurationMs ?? 0,
      topBottlenecks:  this._workspace.pipeline?.bottleneck ? [this._workspace.pipeline.bottleneck] : [],
      recommendations: ["Review failing stages.", "Optimize slowest pipeline steps.", "Check token costs weekly."],
    };
  }
}

class DefaultResourceMonitor implements IResourceMonitor {
  private _history: ResourceUsage[] = [];

  capture(): ResourceUsage {
    const usage: ResourceUsage = {
      cpuPercent: Math.round(20 + Math.random() * 50),
      ramMb:      Math.round(4096 + Math.random() * 4096),
      storageGb:  Math.round(50 + Math.random() * 200),
      networkMbps: Math.round(10 + Math.random() * 90),
      gpus: [{
        deviceId:           "gpu-0",
        utilizationPercent: Math.round(30 + Math.random() * 60),
        memoryUsedMb:       Math.round(4096 + Math.random() * 4096),
        memoryTotalMb:      16384,
        temperatureC:       Math.round(50 + Math.random() * 30),
        powerWatts:         Math.round(150 + Math.random() * 100),
        capturedAt:         new Date(),
      }],
      memory: {
        usedMb:      Math.round(8192 + Math.random() * 8192),
        totalMb:     32768,
        freeMb:      Math.round(8192 - Math.random() * 4096),
        usedPercent: 0,
        capturedAt:  new Date(),
      },
      tokens: {
        promptTokens:     Math.round(1000 + Math.random() * 5000),
        completionTokens: Math.round(500 + Math.random() * 2000),
        totalTokens:      0,
        costUsd:          0,
        modelId:          "gemini-2.0-flash",
        capturedAt:       new Date(),
      },
      costs: {
        totalUsd:        Math.round(Math.random() * 10 * 100) / 100,
        apiCostUsd:      Math.round(Math.random() * 5 * 100) / 100,
        computeCostUsd:  Math.round(Math.random() * 3 * 100) / 100,
        storageCostUsd:  Math.round(Math.random() * 2 * 100) / 100,
        budgetUsd:       100,
        budgetUsedPercent: 0,
        capturedAt:      new Date(),
      },
      capturedAt: new Date(),
    };
    // Fill derived fields
    usage.memory.usedPercent   = Math.round(usage.memory.usedMb / usage.memory.totalMb * 100);
    usage.memory.freeMb        = usage.memory.totalMb - usage.memory.usedMb;
    usage.tokens.totalTokens   = usage.tokens.promptTokens + usage.tokens.completionTokens;
    usage.tokens.costUsd       = Math.round(usage.tokens.totalTokens * 0.000_002 * 100) / 100;
    usage.costs.budgetUsedPercent = Math.round(usage.costs.totalUsd / usage.costs.budgetUsd * 100);

    this._history.push(usage);
    if (this._history.length > 1000) this._history.shift();
    return usage;
  }

  getLatest(): ResourceUsage {
    return this._history[this._history.length - 1] ?? this.capture();
  }

  getHistory(): ResourceUsage[] { return [...this._history]; }

  isOverloaded(): boolean {
    const latest = this.getLatest();
    return latest.cpuPercent > 90 || (latest.gpus[0]?.utilizationPercent ?? 0) > 95 || latest.memory.usedPercent > 90;
  }
}

class DefaultLogCollector implements ILogCollector {
  private _logs: ExecutionLog[] = [];
  private _idCounter = 0;

  collect(
    level: ExecutionLog["level"],
    engineKey: string,
    engineName: string,
    message: string,
    metadata: Record<string, unknown> = {}
  ): ExecutionLog {
    const log: ExecutionLog = {
      id: `log-${++this._idCounter}-${Date.now()}`, level, engineKey, engineName, message, timestamp: new Date(), metadata,
    };
    this._logs.push(log);
    if (this._logs.length > 10_000) this._logs.shift();
    return log;
  }

  getLogs(engineKey?: string, limit = 100): ExecutionLog[] {
    const filtered = engineKey ? this._logs.filter(l => l.engineKey === engineKey) : this._logs;
    return [...filtered].reverse().slice(0, limit);
  }

  clear(): void { this._logs = []; }
}

class DefaultHealthMonitor implements ISystemHealthMonitor {
  private _latest?: SystemHealth;

  compute(
    engines: Record<string, boolean>,
    providers: Record<string, boolean>,
    resources: ResourceUsage,
    criticalAlerts: number
  ): SystemHealth {
    const engineScores: Record<string, number> = {};
    for (const [key, ok] of Object.entries(engines)) {
      engineScores[key] = ok ? 100 : 0;
    }
    const avgEngine   = Object.values(engineScores).reduce((s, v) => s + v, 0) / Math.max(Object.values(engineScores).length, 1);
    const memHealth   = 100 - resources.memory.usedPercent;
    const gpuHealth   = 100 - (resources.gpus[0]?.utilizationPercent ?? 0);
    const alertPenalty = Math.min(criticalAlerts * 10, 40);
    const overall     = Math.max(0, Math.round((avgEngine * 0.5 + memHealth * 0.2 + gpuHealth * 0.2) - alertPenalty));
    this._latest = {
      overallScore:   overall,
      engineHealth:   engineScores,
      providerHealth: providers,
      memoryHealth:   memHealth,
      queueHealth:    100 - Math.min(criticalAlerts * 5, 100),
      healthy:        overall >= 60 && criticalAlerts === 0,
      criticalAlerts,
      capturedAt:     new Date(),
    };
    return this._latest;
  }

  getLatest(): SystemHealth {
    return this._latest ?? {
      overallScore: 100, engineHealth: {}, providerHealth: {}, memoryHealth: 100,
      queueHealth: 100, healthy: true, criticalAlerts: 0, capturedAt: new Date(),
    };
  }
}

// ─── Founder Engine ───────────────────────────────────────────────────────────

export class FounderEngine implements IFounderEngine {
  private _state:     FounderState = FounderState.CREATED;
  private _workspace: FounderWorkspace;
  private _history:   ExecutionSummary[] = [];
  private _commands:  CommandHistory[]   = [];

  private readonly _dashboard:   IDashboardManager;
  private readonly _workspaceMgr:IWorkspaceManager;
  private readonly _timeline:    ITimelineManager;
  private readonly _agentMon:    IAgentMonitor;
  private readonly _alertMgr:    IAlertManager;
  private readonly _notifMgr:    INotificationManager;
  private readonly _resourceMon: IResourceMonitor;
  private readonly _healthMon:   ISystemHealthMonitor;
  private readonly _logger:      ILogCollector;

  constructor(
    public readonly context: any,
    dashboard?:    IDashboardManager,
    workspace?:    IWorkspaceManager,
    timeline?:     ITimelineManager,
    agentMonitor?: IAgentMonitor,
    alertManager?: IAlertManager,
    notifMgr?:     INotificationManager,
    resourceMon?:  IResourceMonitor,
    healthMon?:    ISystemHealthMonitor,
    logCollector?: ILogCollector,
    public readonly metadata: Record<string, unknown> = {}
  ) {
    this._dashboard   = dashboard    || new DefaultDashboardManager();
    this._timeline    = timeline     || new DefaultTimelineManager();
    this._agentMon    = agentMonitor || new DefaultAgentMonitor();
    this._alertMgr    = alertManager || new DefaultAlertManager();
    this._notifMgr    = notifMgr     || new DefaultNotificationManager();
    this._resourceMon = resourceMon  || new DefaultResourceMonitor();
    this._healthMon   = healthMon    || new DefaultHealthMonitor();
    this._logger      = logCollector || new DefaultLogCollector();

    // Build initial workspace
    const dash = this._dashboard.createDashboard("Founder Command Center", WorkspaceMode.OVERVIEW);
    this._workspace = {
      id:           `ws-${Date.now()}`,
      name:         "Shaily Studio Workspace",
      mode:         WorkspaceMode.OVERVIEW,
      dashboard:    dash,
      agents:       [],
      resources:    this._resourceMon.capture(),
      health:       this._healthMon.getLatest(),
      activeAlerts: [],
      recentLogs:   [],
      updatedAt:    new Date(),
    };

    this._workspaceMgr = workspace || new DefaultWorkspaceManager(this._workspace);

    // Register all known agents
    for (const eng of ENGINE_REGISTRY) {
      this._agentMon.register(eng.key, eng.label);
    }
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  get state(): FounderState { return this._state; }

  async initialize(): Promise<void> {
    FounderValidator.validateStateTransition("FounderEngine", this._state, FounderState.INITIALIZED);
    this._state = FounderState.INITIALIZED;
    this._logger.collect("INFO", "founderEngine", "Founder Engine", "Initialized Founder Command Center");
    await this._emit("FounderStarted", { state: this._state });
  }

  async start(): Promise<void> {
    FounderValidator.validateStateTransition("FounderEngine", this._state, FounderState.RUNNING);
    this._state = FounderState.RUNNING;
    await this.refresh();
  }

  async stop(): Promise<void> {
    FounderValidator.validateStateTransition("FounderEngine", this._state, FounderState.STOPPED);
    this._state = FounderState.STOPPED;
    this._logger.collect("INFO", "founderEngine", "Founder Engine", "Founder Engine stopped.");
  }

  async recover(): Promise<void> {
    FounderValidator.validateStateTransition("FounderEngine", this._state, FounderState.RECOVERING);
    this._state = FounderState.RECOVERING;
    this._logger.collect("WARN", "founderEngine", "Founder Engine", "Entering recovery mode...");
    await this._emit("SystemRecovered", { previousState: this._state });
    FounderValidator.validateStateTransition("FounderEngine", this._state, FounderState.RUNNING);
    this._state = FounderState.RUNNING;
  }

  // ─── Core Operations ────────────────────────────────────────────────────────

  async refresh(): Promise<FounderWorkspace> {
    const resources = this._resourceMon.capture();
    const ctx       = this.context;

    // ── 1. Pipeline Monitoring ─────────────────────────────────────────────
    const stages: import("./models").PipelineStage[] = ENGINE_REGISTRY.map(eng => {
      const engine = ctx?.[eng.key];
      const hasState = engine && typeof engine.state === "string";
      const status: ExecutionStatus = !engine ? ExecutionStatus.IDLE
        : engine.state?.includes("FAILED") ? ExecutionStatus.FAILED
        : engine.state?.includes("RUNNING") || engine.state?.includes("READY") ? ExecutionStatus.RUNNING
        : ExecutionStatus.COMPLETED;
      return {
        name: eng.label, engineKey: eng.key, status,
        retryCount: 0, startedAt: new Date(),
      };
    });

    const failedCount = stages.filter(s => s.status === ExecutionStatus.FAILED).length;
    const runningCount = stages.filter(s => s.status === ExecutionStatus.RUNNING).length;
    const overallPipelineStatus = failedCount > 0 ? ExecutionStatus.FAILED
      : runningCount > 0 ? ExecutionStatus.RUNNING : ExecutionStatus.COMPLETED;

    const slowestStage = stages.reduce((prev, curr) =>
      (curr.latencyMs ?? 0) > (prev.latencyMs ?? 0) ? curr : prev, stages[0]);

    const pipeline: import("./models").PipelineStatus = {
      id:            `pipe-${Date.now()}`,
      stages,
      overallStatus: overallPipelineStatus,
      startedAt:     new Date(Date.now() - 5000),
      bottleneck:    slowestStage?.name,
    };

    // ── 2. Timeline Recording ──────────────────────────────────────────────
    for (const eng of ENGINE_REGISTRY) {
      this._timeline.record({
        type:        TimelineEventType.CHECKPOINT,
        engineKey:   eng.key,
        engineName:  eng.label,
        description: `Status polled: ${stages.find(s => s.engineKey === eng.key)?.status ?? "UNKNOWN"}`,
        timestamp:   new Date(),
        metadata:    {},
      });
    }
    await this._emit("TimelineUpdated", { eventCount: this._timeline.getEvents().length });

    // ── 3. Agent Monitoring ────────────────────────────────────────────────
    for (const eng of ENGINE_REGISTRY) {
      const engine  = ctx?.[eng.key];
      const status  = engine ? AgentStatus.WORKING : AgentStatus.IDLE;
      this._agentMon.update(eng.key, status, engine ? `Processing (${eng.label})` : "Idle");
    }
    const agents = this._agentMon.getAllAgents();

    // ── 4. Resource Widget Update ──────────────────────────────────────────
    this._updateWidgets(pipeline, resources);
    await this._emit("DashboardUpdated", { widgetsRefreshed: this._workspace.dashboard.widgets.length });

    // ── 5. Logs ────────────────────────────────────────────────────────────
    for (const eng of ENGINE_REGISTRY) {
      const engine = ctx?.[eng.key];
      if (engine) {
        this._logger.collect("INFO", eng.key, eng.label, `Engine polled. State: ${engine.state ?? "UNKNOWN"}`);
      }
    }
    const recentLogs = this._logger.getLogs(undefined, 50);
    await this._emit("ExecutionProgress", { logCount: recentLogs.length });

    // ── 6. Alerts ──────────────────────────────────────────────────────────
    if ((resources.gpus[0]?.utilizationPercent ?? 0) > 90) {
      this._alertMgr.createAlert(AlertSeverity.CRITICAL, "GPU Overloaded", `GPU utilization at ${resources.gpus[0].utilizationPercent}%`, "resourceMonitor");
    }
    if (resources.memory.usedPercent > 90) {
      this._alertMgr.createAlert(AlertSeverity.ERROR, "High Memory Usage", `RAM at ${resources.memory.usedPercent}%`, "resourceMonitor");
    }
    if (resources.costs.budgetUsedPercent > 80) {
      this._alertMgr.createAlert(AlertSeverity.WARNING, "Budget Alert", `${resources.costs.budgetUsedPercent}% of budget consumed`, "costMonitor");
    }
    if (failedCount > 0) {
      this._alertMgr.createAlert(AlertSeverity.ERROR, "Pipeline Failure", `${failedCount} engine(s) in FAILED state`, "pipelineMonitor");
    }
    const activeAlerts = this._alertMgr.getAlerts(false);

    // ── 7. System Health ──────────────────────────────────────────────────
    const engineHealthMap: Record<string, boolean> = {};
    for (const eng of ENGINE_REGISTRY) {
      const stage = stages.find(s => s.engineKey === eng.key);
      engineHealthMap[eng.key] = stage ? stage.status !== ExecutionStatus.FAILED : true;
    }
    const providerHealth: Record<string, boolean> = { youtube: true, instagram: true, tiktok: true, rumble: true };
    const health = this._healthMon.compute(engineHealthMap, providerHealth, resources, this._alertMgr.getCriticalCount());

    if (health.overallScore < 60) {
      await this._emit("HealthChanged", { overallScore: health.overallScore, healthy: health.healthy });
    }

    // ── 8. Workspace Update ───────────────────────────────────────────────
    this._workspace = {
      ...this._workspace,
      pipeline,
      agents,
      resources,
      health,
      activeAlerts,
      recentLogs,
      updatedAt: new Date(),
    };

    await this._emit("WorkspaceUpdated", {
      mode:    this._workspace.mode,
      alerts:  activeAlerts.length,
      health:  health.overallScore,
      agents:  agents.length,
    });

    // ── 9. Memory ─────────────────────────────────────────────────────────
    if (ctx?.memoryStore) {
      await ctx.memoryStore.set("founder-dashboard", `dash:${this._workspace.id}`, { mode: this._workspace.mode, widgets: this._workspace.dashboard.widgets.length });
      await ctx.memoryStore.set("workspace",         `ws:${this._workspace.id}`, { updatedAt: this._workspace.updatedAt });
      await ctx.memoryStore.set("alerts",             `alerts:${this._workspace.id}`, activeAlerts.map(a => a.id));
      await ctx.memoryStore.set("timeline",           `timeline:${this._workspace.id}`, this._timeline.getEvents().length);
      await ctx.memoryStore.set("logs",               `logs:${this._workspace.id}`, recentLogs.length);
      await ctx.memoryStore.set("resource-history",   `resources:${this._workspace.id}`, resources.cpuPercent);
      await ctx.memoryStore.set("system-health",      `health:${this._workspace.id}`, health.overallScore);
      await ctx.memoryStore.set("snapshots",          `snapshots:${this._workspace.id}`, this._workspaceMgr.getSnapshots().length);
    }

    // ── 10. Decision + Planning feedback ─────────────────────────────────
    if (ctx?.decisionEngine?.record) {
      await ctx.decisionEngine.record({
        founderRefreshId:  `refresh-${Date.now()}`,
        pipelineStatus:    overallPipelineStatus,
        activeAlerts:      activeAlerts.length,
        healthScore:       health.overallScore,
        resourceUsage:     { cpu: resources.cpuPercent, ram: resources.ramMb, gpu: resources.gpus[0]?.utilizationPercent ?? 0 },
        bottleneck:        pipeline.bottleneck,
      });
    }

    if (ctx?.planningEngine?.createTask) {
      await ctx.planningEngine.createTask({
        type:   "FOUNDER_REFRESH_COMPLETE",
        health: health.overallScore,
        alerts: activeAlerts.length,
      });
    }

    return this._workspace;
  }

  async snapshot(label?: string): Promise<WorkspaceSnapshot> {
    const snap = this._workspaceMgr.snapshot(label);
    await this._emit("SnapshotCreated", { snapshotId: snap.id, workspaceId: snap.workspaceId });
    return snap;
  }

  getWorkspace(): FounderWorkspace { return this._workspace; }

  getAlerts(resolved?: boolean): Alert[] { return this._alertMgr.getAlerts(resolved); }

  resolveAlert(alertId: string): void {
    this._alertMgr.resolve(alertId);
    this._emit("AlertResolved", { alertId });
  }

  getLogs(limit = 100): ExecutionLog[] { return this._logger.getLogs(undefined, limit); }

  getHealth(): SystemHealth { return this._healthMon.getLatest(); }

  getResources(): ResourceUsage { return this._resourceMon.getLatest(); }

  getHistory(): ExecutionSummary[] { return [...this._history]; }

  sendNotification(title: string, body: string, severity: AlertSeverity, expiresAt?: Date): Notification {
    const notif = this._notifMgr.send(title, body, severity, expiresAt);
    this._emit("NotificationCreated", { notificationId: notif.id, severity });
    return notif;
  }

  getNotifications(): Notification[] { return this._notifMgr.getAll(); }
  markNotificationRead(id: string): void { this._notifMgr.markRead(id); }

  getTimeline(): import("./interfaces").ITimelineManager { return this._timeline; }
  getAgentMonitor(): import("./interfaces").IAgentMonitor { return this._agentMon; }
  getDashboard(): import("./interfaces").IDashboardManager { return this._dashboard; }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private _updateWidgets(pipeline: import("./models").PipelineStatus, resources: ResourceUsage): void {
    const dash = this._workspace.dashboard;
    const findWidget = (type: DashboardWidgetType) => dash.widgets.find(w => w.type === type);

    const pipelineWidget = findWidget(DashboardWidgetType.PIPELINE);
    if (pipelineWidget) this._dashboard.updateWidget(dash.id, pipelineWidget.id, {
      stages:        pipeline.stages.map(s => ({ name: s.name, status: s.status })),
      overallStatus: pipeline.overallStatus,
    });

    const gpuWidget = findWidget(DashboardWidgetType.GPU);
    if (gpuWidget && resources.gpus.length > 0) this._dashboard.updateWidget(dash.id, gpuWidget.id, {
      utilizationPercent: resources.gpus[0].utilizationPercent,
      memoryUsedMb:       resources.gpus[0].memoryUsedMb,
      temperatureC:       resources.gpus[0].temperatureC,
    });

    const memWidget = findWidget(DashboardWidgetType.MEMORY);
    if (memWidget) this._dashboard.updateWidget(dash.id, memWidget.id, {
      usedPercent: resources.memory.usedPercent,
      usedMb:      resources.memory.usedMb,
      totalMb:     resources.memory.totalMb,
    });

    const tokenWidget = findWidget(DashboardWidgetType.TOKEN);
    if (tokenWidget) this._dashboard.updateWidget(dash.id, tokenWidget.id, {
      totalTokens: resources.tokens.totalTokens,
      costUsd:     resources.tokens.costUsd,
    });

    const costWidget = findWidget(DashboardWidgetType.COST);
    if (costWidget) this._dashboard.updateWidget(dash.id, costWidget.id, {
      totalUsd:          resources.costs.totalUsd,
      budgetUsedPercent: resources.costs.budgetUsedPercent,
    });
  }

  private async _emit(name: string, payload: Record<string, unknown>): Promise<void> {
    if (this.context?.eventBus?.publish) {
      try {
        await this.context.eventBus.publish({
          id:        `evt-${name.toLowerCase()}-${Math.random().toString(36).slice(2, 7)}`,
          name,
          timestamp: new Date(),
          source:    "FounderEngine",
          payload,
          metadata:  {},
        });
      } catch (_) {}
    }
  }
}
