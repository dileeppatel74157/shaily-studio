/**
 * Sprint 15.1 — Founder Command Center Engine
 * Verification Suite — 20 Tests
 */

import { FounderEngine }    from "./founder/FounderEngine";
import { FounderBuilder }   from "./founder/FounderBuilder";
import { FounderValidator } from "./founder/FounderValidator";
import { FounderState }     from "./founder/FounderState";
import { WorkspaceMode }    from "./founder/WorkspaceMode";
import { ExecutionStatus }  from "./founder/ExecutionStatus";
import { AlertSeverity }    from "./founder/AlertSeverity";
import { TimelineEventType }from "./founder/TimelineEventType";
import { AgentStatus }      from "./founder/AgentStatus";
import { DashboardWidgetType } from "./founder/DashboardWidgetType";
import {
  FounderValidationException, FounderException,
  DashboardException, AlertException,
  deepFreeze,
} from "./founder/types";
import type {
  FounderDashboard, Alert, Notification, ResourceUsage,
  GpuUsage, MemoryUsage, ExecutionProgress, WorkspaceSnapshot,
  WidgetLayout,
} from "./founder/models";
import type {
  IDashboardManager, ITimelineManager, IAgentMonitor,
  IAlertManager, INotificationManager, IResourceMonitor,
  ISystemHealthMonitor, ILogCollector,
} from "./founder/interfaces";

// ─── Assertion Helper ─────────────────────────────────────────────────────────

function assert(condition: boolean, message: string): void {
  if (!condition) { console.error("❌ Assertion Failed:", message); process.exit(1); }
}

// ─── Mock Helpers ─────────────────────────────────────────────────────────────

function makeContext(overrides: Record<string, any> = {}): any {
  const events: any[] = [];
  const store = new Map<string, any>();
  return {
    logger:   { info: () => {}, error: () => {}, warn: () => {} },
    eventBus: { publish: async (e: any) => { events.push(e); }, _events: events },
    memoryStore: {
      get: async (_ns: string, key: string) => store.has(key) ? { value: store.get(key) } : undefined,
      set: async (_ns: string, key: string, value: any) => { store.set(key, value); },
      _store: store,
    },
    registry: { has: () => false, resolve: () => null },
    ...overrides,
  };
}

function makeResourceUsage(overrides: Partial<ResourceUsage> = {}): ResourceUsage {
  return {
    cpuPercent:  50,
    ramMb:       8192,
    storageGb:   100,
    networkMbps: 50,
    gpus: [{
      deviceId:           "gpu-0",
      utilizationPercent: 60,
      memoryUsedMb:       8192,
      memoryTotalMb:      16384,
      temperatureC:       65,
      powerWatts:         200,
      capturedAt:         new Date(),
    }],
    memory: {
      usedMb: 16384, totalMb: 32768, freeMb: 16384, usedPercent: 50, capturedAt: new Date(),
    },
    tokens: {
      promptTokens: 2000, completionTokens: 1000, totalTokens: 3000,
      costUsd: 0.006, modelId: "gemini-2.0-flash", capturedAt: new Date(),
    },
    costs: {
      totalUsd: 5, apiCostUsd: 3, computeCostUsd: 1.5, storageCostUsd: 0.5,
      budgetUsd: 100, budgetUsedPercent: 5, capturedAt: new Date(),
    },
    capturedAt: new Date(),
    ...overrides,
  } as ResourceUsage;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function runTests(): Promise<void> {
  console.log("=== START FOUNDER COMMAND CENTER ENGINE TESTS ===\n");

  // ==========================================================================
  // 1. Builder Validation
  // ==========================================================================
  console.log("1. Builder Validation...");
  try {
    new FounderBuilder().build();
    throw new Error("Expected FounderValidationException");
  } catch (err: unknown) {
    assert(err instanceof FounderValidationException, "Builder without context must throw FounderValidationException");
  }
  const eng1 = new FounderBuilder().withContext(makeContext()).withMetadata({ sprint: "15.1" }).build();
  assert(eng1 instanceof FounderEngine, "Builder must produce FounderEngine");
  assert(eng1.metadata.sprint === "15.1", "Builder metadata must be stored");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 2. Lifecycle Transitions
  // ==========================================================================
  console.log("2. Lifecycle Transitions...");
  const eng2 = new FounderEngine(makeContext());
  assert(eng2.state === FounderState.CREATED, "Initial state must be CREATED");
  await eng2.initialize();
  assert(eng2.state === FounderState.INITIALIZED, "After initialize() must be INITIALIZED");
  await eng2.start();
  assert(eng2.state === FounderState.RUNNING, "After start() must be RUNNING");
  await eng2.stop();
  assert(eng2.state === FounderState.STOPPED, "After stop() must be STOPPED");

  // Invalid transition
  try {
    FounderValidator.validateStateTransition("test", FounderState.CREATED, FounderState.RUNNING);
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof FounderValidationException, "CREATED → RUNNING must fail validation");
  }
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 3. Dashboard Creation
  // ==========================================================================
  console.log("3. Dashboard Creation...");
  const eng3 = new FounderEngine(makeContext());
  await eng3.initialize();
  const ws3 = eng3.getWorkspace();
  const dash3 = ws3.dashboard;

  assert(!!dash3.id, "Dashboard must have ID");
  assert(!!dash3.name, "Dashboard must have name");
  assert(dash3.widgets.length === Object.values(DashboardWidgetType).length,
    `Dashboard must have ${Object.values(DashboardWidgetType).length} widgets (one per type)`);
  assert(dash3.layout.length === dash3.widgets.length, "Layout must have one entry per widget");

  // Every widget type present
  for (const type of Object.values(DashboardWidgetType)) {
    assert(dash3.widgets.some(w => w.type === type), `Widget type ${type} must be present`);
  }
  // Validate dashboard
  FounderValidator.validateDashboard(dash3);
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 4. Workspace Management
  // ==========================================================================
  console.log("4. Workspace Management...");
  const eng4 = new FounderEngine(makeContext());
  await eng4.initialize();
  await eng4.start();
  const ws4 = eng4.getWorkspace();
  assert(!!ws4.id, "Workspace must have ID");
  assert(!!ws4.name, "Workspace must have name");
  assert(ws4.mode === WorkspaceMode.OVERVIEW, "Default workspace mode must be OVERVIEW");
  assert(Array.isArray(ws4.agents), "Workspace must have agents array");
  assert(ws4.agents.length === 15, "Workspace must have 15 registered agents (all known engines)");
  assert(ws4.updatedAt instanceof Date, "Workspace must have updatedAt");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 5. Timeline Generation
  // ==========================================================================
  console.log("5. Timeline Generation...");
  const eng5 = new FounderEngine(makeContext());
  await eng5.initialize();
  await eng5.refresh();
  const timeline5 = eng5.getTimeline().getTimeline();
  assert(Array.isArray(timeline5.events), "Timeline events must be an array");
  assert(timeline5.events.length >= 15, "Must record at least 15 timeline events (one per engine)");
  // All events have required fields
  for (const evt of timeline5.events) {
    assert(!!evt.id, "Timeline event must have ID");
    assert(!!evt.engineKey, "Timeline event must have engineKey");
    assert(Object.values(TimelineEventType).includes(evt.type), "Timeline event type must be valid");
    assert(evt.timestamp instanceof Date, "Timeline event timestamp must be Date");
  }
  // Timeline must be in chronological order
  FounderValidator.validateTimelineOrder(timeline5.events);
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 6. Agent Monitoring
  // ==========================================================================
  console.log("6. Agent Monitoring...");
  const eng6 = new FounderEngine(makeContext());
  await eng6.initialize();
  await eng6.refresh();
  const agents6 = eng6.getAgentMonitor().getAllAgents();
  assert(agents6.length === 15, "Must have 15 registered agents");
  for (const agent of agents6) {
    assert(!!agent.agentId, "Agent must have agentId");
    assert(!!agent.name, "Agent must have name");
    assert(Object.values(AgentStatus).includes(agent.status), "Agent status must be valid");
    assert(agent.statistics.totalRuns >= 0, "Agent totalRuns must be ≥ 0");
    assert(agent.statistics.avgDurationMs >= 0, "avgDurationMs must be ≥ 0");
  }
  // Record a run
  eng6.getAgentMonitor().recordRun("researchEngine", true, 1200);
  const research6 = eng6.getAgentMonitor().getAgent("researchEngine");
  assert(research6?.statistics.totalRuns === 1, "ResearchEngine must have 1 recorded run");
  assert(research6?.statistics.avgDurationMs === 1200, "avgDurationMs must be 1200");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 7. Resource Monitoring
  // ==========================================================================
  console.log("7. Resource Monitoring...");
  const eng7 = new FounderEngine(makeContext());
  await eng7.initialize();
  await eng7.refresh();
  const res7 = eng7.getResources();
  assert(res7.cpuPercent >= 0 && res7.cpuPercent <= 100, "CPU must be 0–100");
  assert(res7.ramMb > 0, "RAM must be > 0");
  assert(res7.storageGb > 0, "Storage must be > 0");
  assert(res7.tokens.totalTokens > 0, "Tokens must be > 0");
  assert(res7.costs.budgetUsd > 0, "Budget must be > 0");
  FounderValidator.validateResourceUsage(res7);
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 8. GPU Monitoring
  // ==========================================================================
  console.log("8. GPU Monitoring...");
  const res8 = eng7.getResources();
  assert(Array.isArray(res8.gpus), "GPUs must be an array");
  assert(res8.gpus.length > 0, "Must have at least one GPU");
  for (const gpu of res8.gpus) {
    assert(gpu.utilizationPercent >= 0 && gpu.utilizationPercent <= 100, "GPU util must be 0–100");
    assert(gpu.memoryUsedMb <= gpu.memoryTotalMb, "GPU memoryUsed must not exceed total");
    assert(gpu.temperatureC >= 0, "GPU temperature must be ≥ 0");
    assert(!!gpu.deviceId, "GPU must have deviceId");
    FounderValidator.validateGpuUsage(gpu);
  }
  // Widget must be updated with GPU data
  const dash8 = eng7.getWorkspace().dashboard;
  const gpuWidget = dash8.widgets.find(w => w.type === DashboardWidgetType.GPU);
  assert(gpuWidget !== undefined, "GPU widget must exist");
  assert(typeof gpuWidget!.data.utilizationPercent === "number", "GPU widget must have utilizationPercent");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 9. Memory Monitoring
  // ==========================================================================
  console.log("9. Memory Monitoring...");
  const mem9 = eng7.getResources().memory;
  assert(mem9.usedMb <= mem9.totalMb, "usedMb must not exceed totalMb");
  assert(mem9.usedPercent >= 0 && mem9.usedPercent <= 100, "usedPercent must be 0–100");
  assert(mem9.freeMb >= 0, "freeMb must be ≥ 0");
  FounderValidator.validateMemoryUsage(mem9);
  // Widget check
  const dash9   = eng7.getWorkspace().dashboard;
  const memWidget = dash9.widgets.find(w => w.type === DashboardWidgetType.MEMORY);
  assert(memWidget !== undefined, "MEMORY widget must exist");
  assert(typeof memWidget!.data.usedPercent === "number", "MEMORY widget must have usedPercent");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 10. Alert Generation
  // ==========================================================================
  console.log("10. Alert Generation...");
  const eng10 = new FounderEngine(makeContext());
  await eng10.initialize();

  // Manually create alerts
  const alert10a = eng10.getAlerts();
  const alertMgr10 = (eng10 as any)._alertMgr as IAlertManager;

  const infoAlert  = alertMgr10.createAlert(AlertSeverity.INFO,     "Info Alert",    "Test info",    "testEngine");
  const warnAlert  = alertMgr10.createAlert(AlertSeverity.WARNING,  "Warn Alert",    "Test warning", "testEngine");
  const errAlert   = alertMgr10.createAlert(AlertSeverity.ERROR,    "Error Alert",   "Test error",   "testEngine");
  const critAlert  = alertMgr10.createAlert(AlertSeverity.CRITICAL, "Critical Alert","Test critical","testEngine");

  const allAlerts = alertMgr10.getAlerts();
  assert(allAlerts.length >= 4, "Must have at least 4 alerts after creation");
  assert(allAlerts.some(a => a.severity === AlertSeverity.CRITICAL), "Must have a CRITICAL alert");
  assert(alertMgr10.getCriticalCount() >= 1, "getCriticalCount must return ≥ 1");

  // Resolve
  alertMgr10.resolve(infoAlert.id);
  const resolved = alertMgr10.getAlerts(true);
  assert(resolved.some(a => a.id === infoAlert.id), "Resolved alert must appear in resolved list");
  assert(resolved.find(a => a.id === infoAlert.id)?.resolvedAt instanceof Date, "resolvedAt must be set");

  // Duplicate alert IDs validation
  try {
    FounderValidator.validateNoDuplicateAlerts([infoAlert, infoAlert]);
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof FounderValidationException, "Duplicate alert IDs must fail validation");
  }
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 11. Notification System
  // ==========================================================================
  console.log("11. Notification System...");
  const eng11 = new FounderEngine(makeContext());
  await eng11.initialize();
  const notif11 = eng11.sendNotification(
    "Pipeline Complete", "All stages executed successfully.", AlertSeverity.INFO,
    new Date(Date.now() + 3600_000)
  );
  assert(!!notif11.id, "Notification must have ID");
  assert(notif11.severity === AlertSeverity.INFO, "Notification severity must match");
  assert(notif11.read === false, "New notification must be unread");
  FounderValidator.validateNotification(notif11);

  eng11.markNotificationRead(notif11.id);
  const notifs11 = eng11.getNotifications();
  assert(notifs11.find(n => n.id === notif11.id)?.read === true, "Notification must be marked read");

  const unread11 = (eng11 as any)._notifMgr.getUnread();
  assert(!unread11.some((n: any) => n.id === notif11.id), "Read notification must not appear in unread list");

  // Expired notification validation
  try {
    FounderValidator.validateNotification({
      ...notif11, expiresAt: new Date(Date.now() - 1000),
      id: "n-exp-001", createdAt: new Date(),
    });
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof FounderValidationException, "Notification with past expiresAt must fail");
  }
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 12. Live Log Collection
  // ==========================================================================
  console.log("12. Live Log Collection...");
  const eng12 = new FounderEngine(makeContext());
  await eng12.initialize();
  await eng12.refresh();
  const logs12 = eng12.getLogs(100);
  assert(logs12.length > 0, "Must have collected logs after refresh");
  for (const log of logs12) {
    assert(!!log.id, "Log must have ID");
    assert(!!log.engineKey, "Log must have engineKey");
    assert(!!log.message, "Log must have message");
    assert(["INFO", "WARN", "ERROR", "DEBUG"].includes(log.level), "Log level must be valid");
    assert(log.timestamp instanceof Date, "Log timestamp must be Date");
  }
  // Filter by engine
  const logCollector12 = (eng12 as any)._logger as ILogCollector;
  logCollector12.collect("ERROR", "qualityEngine", "Quality Engine", "Quality check failed for video-123");
  const qualityLogs = logCollector12.getLogs("qualityEngine");
  assert(qualityLogs.length > 0, "Must find logs filtered by engineKey");
  assert(qualityLogs.every(l => l.engineKey === "qualityEngine"), "Filtered logs must all be from qualityEngine");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 13. Health Monitoring
  // ==========================================================================
  console.log("13. Health Monitoring...");
  const eng13 = new FounderEngine(makeContext());
  await eng13.initialize();
  await eng13.refresh();
  const health13 = eng13.getHealth();
  assert(health13.overallScore >= 0 && health13.overallScore <= 100, "Health score must be 0–100");
  assert(typeof health13.healthy === "boolean", "healthy must be boolean");
  assert(health13.memoryHealth >= 0 && health13.memoryHealth <= 100, "memoryHealth must be 0–100");
  assert(health13.queueHealth >= 0 && health13.queueHealth <= 100, "queueHealth must be 0–100");
  assert(typeof health13.criticalAlerts === "number", "criticalAlerts must be a number");
  assert(health13.capturedAt instanceof Date, "health capturedAt must be Date");

  // Check engine health entries
  assert(Object.keys(health13.engineHealth).length > 0, "engineHealth must have entries");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 14. Memory Integration
  // ==========================================================================
  console.log("14. Memory Integration...");
  const ctx14 = makeContext();
  const eng14 = new FounderEngine(ctx14);
  await eng14.initialize();
  await eng14.refresh();
  const mem14 = ctx14.memoryStore._store as Map<string, any>;
  assert(mem14.has(`dash:${eng14.getWorkspace().id}`),    "founder-dashboard namespace must be written");
  assert(mem14.has(`ws:${eng14.getWorkspace().id}`),      "workspace namespace must be written");
  assert(mem14.has(`alerts:${eng14.getWorkspace().id}`),  "alerts namespace must be written");
  assert(mem14.has(`timeline:${eng14.getWorkspace().id}`),"timeline namespace must be written");
  assert(mem14.has(`logs:${eng14.getWorkspace().id}`),    "logs namespace must be written");
  assert(mem14.has(`resources:${eng14.getWorkspace().id}`),"resource-history namespace must be written");
  assert(mem14.has(`health:${eng14.getWorkspace().id}`),  "system-health namespace must be written");
  assert(mem14.has(`snapshots:${eng14.getWorkspace().id}`),"snapshots namespace must be written");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 15. Decision Integration
  // ==========================================================================
  console.log("15. Decision Integration...");
  let decisionCalled = false;
  const ctx15 = makeContext({
    decisionEngine: {
      record: async (data: any) => {
        decisionCalled = true;
        assert(data.founderRefreshId !== undefined, "Decision must include founderRefreshId");
        assert(data.pipelineStatus !== undefined, "Decision must include pipelineStatus");
        assert(data.healthScore !== undefined, "Decision must include healthScore");
        assert(data.activeAlerts !== undefined, "Decision must include activeAlerts");
      },
    },
  });
  const eng15 = new FounderEngine(ctx15);
  await eng15.initialize();
  await eng15.refresh();
  assert(decisionCalled, "Decision engine record must be called after refresh");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 16. Planning Integration
  // ==========================================================================
  console.log("16. Planning Integration...");
  let planningCalled = false;
  const ctx16 = makeContext({
    planningEngine: {
      createTask: async (task: any) => {
        planningCalled = true;
        assert(task.type === "FOUNDER_REFRESH_COMPLETE", "Planning task type must be FOUNDER_REFRESH_COMPLETE");
        assert(task.health !== undefined, "Planning task must include health score");
      },
    },
  });
  const eng16 = new FounderEngine(ctx16);
  await eng16.initialize();
  await eng16.refresh();
  assert(planningCalled, "Planning engine createTask must be called after refresh");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 17. Event Publishing
  // ==========================================================================
  console.log("17. Event Publishing...");
  const ctx17 = makeContext();
  const eng17 = new FounderEngine(ctx17);
  await eng17.initialize();
  await eng17.refresh();
  await eng17.snapshot("Test snapshot");
  eng17.sendNotification("Test", "Test body", AlertSeverity.INFO);
  eng17.resolveAlert((eng17 as any)._alertMgr.createAlert(AlertSeverity.INFO, "Resolve Me", "msg", "engine").id);

  const evtNames = (ctx17.eventBus._events as any[]).map((e: any) => e.name);
  assert(evtNames.includes("FounderStarted"),      "FounderStarted must be emitted");
  assert(evtNames.includes("WorkspaceUpdated"),    "WorkspaceUpdated must be emitted");
  assert(evtNames.includes("DashboardUpdated"),    "DashboardUpdated must be emitted");
  assert(evtNames.includes("TimelineUpdated"),     "TimelineUpdated must be emitted");
  assert(evtNames.includes("ExecutionProgress"),   "ExecutionProgress must be emitted");
  assert(evtNames.includes("SnapshotCreated"),     "SnapshotCreated must be emitted");
  assert(evtNames.includes("NotificationCreated"), "NotificationCreated must be emitted");
  assert(evtNames.includes("AlertResolved"),       "AlertResolved must be emitted");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 18. Snapshot Immutability
  // ==========================================================================
  console.log("18. Snapshot Immutability...");
  const eng18 = new FounderEngine(makeContext());
  await eng18.initialize();
  await eng18.refresh();
  const snap18 = await eng18.snapshot("Immutability Test");
  FounderValidator.validateSnapshot(snap18);
  assert(!!snap18.id, "Snapshot must have ID");
  assert(!!snap18.workspaceId, "Snapshot must have workspaceId");
  assert(snap18.capturedAt instanceof Date, "Snapshot capturedAt must be a Date");
  assert(snap18.label === "Immutability Test", "Snapshot label must be stored");
  assert(Object.isFrozen(snap18), "Snapshot must be frozen");

  let mutFailed = false;
  try { (snap18 as any).id = "hacked"; } catch (_) { mutFailed = true; }
  assert(snap18.id !== "hacked" || mutFailed, "Snapshot ID must not be mutable");

  // Dashboard snapshot
  const dashSnap18 = eng18.getDashboard().snapshot(eng18.getWorkspace().dashboard.id);
  assert(!!dashSnap18.id, "DashboardSnapshot must have ID");
  assert(Array.isArray(dashSnap18.widgets), "DashboardSnapshot must have widgets array");
  assert(Object.isFrozen(dashSnap18), "DashboardSnapshot must be frozen");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 19. Validator Rules
  // ==========================================================================
  console.log("19. Validator Rules...");

  // 19a. Empty dashboard ID
  try {
    FounderValidator.validateDashboard({ id: "", name: "Test", mode: WorkspaceMode.OVERVIEW, widgets: [], layout: [], createdAt: new Date(), updatedAt: new Date() });
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof FounderValidationException, "Empty dashboard ID must fail");
  }

  // 19b. Duplicate widget IDs
  const dashBad: FounderDashboard = {
    id: "d-dup", name: "Test", mode: WorkspaceMode.OVERVIEW,
    widgets: [
      { id: "w1", type: DashboardWidgetType.GPU, title: "A", data: {}, lastUpdated: new Date(), healthy: true, visible: true },
      { id: "w1", type: DashboardWidgetType.MEMORY, title: "B", data: {}, lastUpdated: new Date(), healthy: true, visible: true },
    ],
    layout: [], createdAt: new Date(), updatedAt: new Date(),
  };
  try {
    FounderValidator.validateDashboard(dashBad);
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof FounderValidationException, "Duplicate widget IDs must fail");
  }

  // 19c. Widget layout out of range
  try {
    FounderValidator.validateLayout([{ widgetId: "w1", row: 0, col: 0, width: 15, height: 2 }]);
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof FounderValidationException, "Widget width > 12 must fail");
  }

  // 19d. Alert with empty title
  try {
    FounderValidator.validateAlert({ id: "a1", severity: AlertSeverity.INFO, title: "", message: "m", engineKey: "e", source: "e", resolved: false, createdAt: new Date(), metadata: {} });
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof FounderValidationException, "Empty alert title must fail");
  }

  // 19e. Timeline out of order
  const now19 = new Date();
  const past19 = new Date(now19.getTime() - 1000);
  try {
    FounderValidator.validateTimelineOrder([
      { id: "e1", type: TimelineEventType.START, engineKey: "e", engineName: "E", description: "d", timestamp: now19, metadata: {} },
      { id: "e2", type: TimelineEventType.FINISH, engineKey: "e", engineName: "E", description: "d", timestamp: past19, metadata: {} },
    ]);
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof FounderValidationException, "Out-of-order timeline must fail");
  }

  // 19f. Execution progress > 100%
  try {
    FounderValidator.validateExecutionProgress({ correlationId: "c1", totalStages: 5, completedStages: 3, failedStages: 0, progressPercent: 120, status: ExecutionStatus.RUNNING });
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof FounderValidationException, "Progress > 100% must fail");
  }

  // 19g. GPU memory exceeded
  try {
    FounderValidator.validateGpuUsage({ deviceId: "gpu-0", utilizationPercent: 50, memoryUsedMb: 20000, memoryTotalMb: 16384, temperatureC: 70, powerWatts: 250, capturedAt: new Date() });
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof FounderValidationException, "GPU memoryUsed > total must fail");
  }

  // 19h. Memory used > total
  try {
    FounderValidator.validateMemoryUsage({ usedMb: 40000, totalMb: 32768, freeMb: 0, usedPercent: 100, capturedAt: new Date() });
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof FounderValidationException, "Memory usedMb > totalMb must fail");
  }

  // 19i. Notification with empty title
  try {
    FounderValidator.validateNotification({ id: "n1", title: "", body: "b", severity: AlertSeverity.INFO, read: false, createdAt: new Date() });
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof FounderValidationException, "Notification with empty title must fail");
  }

  // 19j. Snapshot with empty workspaceId
  try {
    FounderValidator.validateSnapshot({ id: "s1", workspaceId: "", state: {} as any, capturedAt: new Date() });
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof FounderValidationException, "Snapshot with empty workspaceId must fail");
  }

  console.log("✓ Passed.\n");

  // ==========================================================================
  // 20. Full End-to-End Founder Command Center
  // ==========================================================================
  console.log("20. Full End-to-End Founder Command Center...");

  let e2eDecision = false;
  let e2ePlanning = false;

  const ctxE2E = makeContext({
    decisionEngine: { record: async () => { e2eDecision = true; } },
    planningEngine: { createTask: async () => { e2ePlanning = true; } },
    // Simulate connected engines
    researchEngine:    { state: "COMPLETED" },
    strategyEngine:    { state: "COMPLETED" },
    scriptEngine:      { state: "RUNNING" },
    qualityEngine:     { state: "COMPLETED" },
    publishingEngine:  { state: "READY" },
    analyticsEngine:   { state: "COMPLETED" },
    channelManager:    { state: "READY" },
  });

  const engE2E = new FounderBuilder()
    .withContext(ctxE2E)
    .withMetadata({ sprint: "15.1", mode: "production" })
    .build();

  // Step 1: Initialize + Start
  await engE2E.initialize();
  assert(engE2E.state === FounderState.INITIALIZED, "E2E: must be INITIALIZED");
  await engE2E.start();
  assert(engE2E.state === FounderState.RUNNING, "E2E: must be RUNNING");

  // Step 2: Refresh
  const wsE2E = await engE2E.refresh();
  assert(!!wsE2E.id, "E2E: workspace must have ID");
  assert(wsE2E.agents.length === 15, "E2E: must have 15 agents");
  assert(wsE2E.dashboard.widgets.length > 0, "E2E: dashboard must have widgets");

  // Step 3: Pipeline monitoring
  const pipeline5 = wsE2E.pipeline;
  assert(pipeline5 !== undefined, "E2E: pipeline must be present");
  assert(pipeline5!.stages.length === 15, "E2E: must monitor all 15 engine stages");
  // Engines present in ctx should show RUNNING or COMPLETED
  const scriptStage = pipeline5!.stages.find(s => s.engineKey === "scriptEngine");
  assert(scriptStage?.status === ExecutionStatus.RUNNING, "E2E: scriptEngine must show RUNNING status");

  // Step 4: Timeline
  const timelineE2E = engE2E.getTimeline().getTimeline();
  assert(timelineE2E.events.length >= 30, "E2E: at least 30 timeline events (2 refreshes × 15 engines)");

  // Step 5: Agent Monitor
  engE2E.getAgentMonitor().recordRun("qualityEngine", true, 3500);
  const qaAgent = engE2E.getAgentMonitor().getAgent("qualityEngine");
  assert(qaAgent?.statistics.totalRuns === 1, "E2E: Quality agent must have 1 run recorded");

  // Step 6: Alerts (manually trigger)
  const alertMgrE2E = (engE2E as any)._alertMgr as IAlertManager;
  const pubFailAlert = alertMgrE2E.createAlert(
    AlertSeverity.ERROR, "Publishing Failed", "Video failed to upload to YouTube", "publishingEngine"
  );
  assert(engE2E.getAlerts(false as any).some((a: Alert) => a.id === pubFailAlert.id), "E2E: alert must appear in active alerts");

  // Resolve alert
  engE2E.resolveAlert(pubFailAlert.id);
  assert(alertMgrE2E.getAlerts(true).some((a: Alert) => a.id === pubFailAlert.id), "E2E: resolved alert must appear in resolved list");

  // Step 7: Notifications
  const notifE2E = engE2E.sendNotification(
    "GPU Spike Detected", "GPU utilization reached 85%", AlertSeverity.WARNING,
    new Date(Date.now() + 3600_000)
  );
  assert(!!notifE2E.id, "E2E: notification must have ID");
  assert(notifE2E.severity === AlertSeverity.WARNING, "E2E: notification severity must be WARNING");

  // Step 8: Logs
  const logsE2E = engE2E.getLogs(50);
  assert(logsE2E.length > 0, "E2E: must have logs");
  assert(logsE2E.every((l: any) => !!l.engineKey), "E2E: all logs must have engineKey");

  // Step 9: Health
  const healthE2E = engE2E.getHealth();
  assert(healthE2E.overallScore >= 0 && healthE2E.overallScore <= 100, "E2E: health score must be valid");
  assert(typeof healthE2E.healthy === "boolean", "E2E: healthy flag must be boolean");

  // Step 10: Resources
  const resE2E = engE2E.getResources();
  FounderValidator.validateResourceUsage(resE2E);
  FounderValidator.validateGpuUsage(resE2E.gpus[0]);
  FounderValidator.validateMemoryUsage(resE2E.memory);

  // Step 11: Workspace snapshot
  const snapE2E = await engE2E.snapshot("E2E Checkpoint");
  assert(Object.isFrozen(snapE2E), "E2E: snapshot must be frozen");
  assert(snapE2E.label === "E2E Checkpoint", "E2E: snapshot label must match");

  // Step 12: Dashboard snapshot
  const dashSnapE2E = engE2E.getDashboard().snapshot(wsE2E.dashboard.id);
  assert(Object.isFrozen(dashSnapE2E), "E2E: dashboard snapshot must be frozen");
  assert(dashSnapE2E.widgets.length > 0, "E2E: dashboard snapshot must have widgets");

  // Step 13: Widget state verification
  const pipWidget = wsE2E.dashboard.widgets.find(w => w.type === DashboardWidgetType.PIPELINE);
  assert(pipWidget !== undefined, "E2E: PIPELINE widget must exist");
  assert(Array.isArray(pipWidget!.data.stages), "E2E: PIPELINE widget must have stages array");

  const costWidget = wsE2E.dashboard.widgets.find(w => w.type === DashboardWidgetType.COST);
  assert(costWidget !== undefined, "E2E: COST widget must exist");
  assert(typeof costWidget!.data.budgetUsedPercent === "number", "E2E: COST widget must have budgetUsedPercent");

  // Step 14: Decision + Planning integrations
  assert(e2eDecision, "E2E: Decision engine must receive feedback");
  assert(e2ePlanning, "E2E: Planning engine must receive feedback");

  // Step 15: Events
  const evtsE2E = (ctxE2E.eventBus._events as any[]).map((e: any) => e.name);
  assert(evtsE2E.includes("FounderStarted"),    "E2E: FounderStarted must be emitted");
  assert(evtsE2E.includes("WorkspaceUpdated"),  "E2E: WorkspaceUpdated must be emitted");
  assert(evtsE2E.includes("DashboardUpdated"),  "E2E: DashboardUpdated must be emitted");
  assert(evtsE2E.includes("TimelineUpdated"),   "E2E: TimelineUpdated must be emitted");
  assert(evtsE2E.includes("SnapshotCreated"),   "E2E: SnapshotCreated must be emitted");
  assert(evtsE2E.includes("NotificationCreated"),"E2E: NotificationCreated must be emitted");
  assert(evtsE2E.includes("AlertResolved"),     "E2E: AlertResolved must be emitted");

  // Step 16: Memory namespaces
  const e2eMemStore = ctxE2E.memoryStore._store as Map<string, any>;
  assert(e2eMemStore.has(`dash:${wsE2E.id}`),      "E2E: founder-dashboard namespace written");
  assert(e2eMemStore.has(`ws:${wsE2E.id}`),        "E2E: workspace namespace written");
  assert(e2eMemStore.has(`alerts:${wsE2E.id}`),    "E2E: alerts namespace written");
  assert(e2eMemStore.has(`timeline:${wsE2E.id}`),  "E2E: timeline namespace written");
  assert(e2eMemStore.has(`logs:${wsE2E.id}`),      "E2E: logs namespace written");
  assert(e2eMemStore.has(`resources:${wsE2E.id}`), "E2E: resource-history namespace written");
  assert(e2eMemStore.has(`health:${wsE2E.id}`),    "E2E: system-health namespace written");

  // Step 17: Stop
  await engE2E.stop();
  assert(engE2E.state === FounderState.STOPPED, "E2E: engine must be STOPPED after stop()");

  console.log("✓ Passed.\n");

  console.log("=== ALL 20 FOUNDER COMMAND CENTER ENGINE TESTS PASSED ✓ ===");
}

runTests().catch((err) => {
  console.error("Test suite execution failed:", err);
  process.exit(1);
});
