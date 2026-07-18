/**
 * Sprint 15.2 — Founder Control Center Engine
 * Verification Suite — 20 Tests
 */

import { ControlCenterEngine }       from "./control-center/ControlCenterEngine";
import { ControlCenterBuilder }      from "./control-center/ControlCenterBuilder";
import { ControlCenterValidator }    from "./control-center/ControlCenterValidator";
import { ControlCenterState }        from "./control-center/ControlCenterState";
import { OverrideType }              from "./control-center/OverrideType";
import { EmergencyLevel }            from "./control-center/EmergencyLevel";
import { BudgetState }               from "./control-center/BudgetState";
import { NotificationPriority }      from "./control-center/NotificationPriority";
import { ExecutionPermission }       from "./control-center/ExecutionPermission";
import { ControlAction }             from "./control-center/ControlAction";
import {
  ControlValidationException,
  ControlException,
  OverrideException,
  BudgetException,
} from "./control-center/types";
import type {
  ControlRequest,
  ManualOverride,
  BudgetLimit,
  BudgetUsage,
  Notification,
  ApprovalRequest,
  ExecutionLock,
  EmergencySnapshot,
  ControlTimelineEvent,
  ControlSnapshot,
  ExecutionPermissionRule,
} from "./control-center/models";
import type {
  IDashboardManager, ITimelineManager, IAgentMonitor,
  IAlertManager, INotificationManager, IResourceMonitor,
  ISystemHealthMonitor, ILogCollector,
} from "./founder/interfaces";

// ─── Assertion Helper ─────────────────────────────────────────────────────────

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("❌ Assertion Failed:", message);
    process.exit(1);
  }
}

// ─── Mock Helpers ─────────────────────────────────────────────────────────────

function makeContext(overrides: Record<string, any> = {}): any {
  const events: any[] = [];
  const store = new Map<string, any>();
  return {
    logger: { info: () => {}, error: () => {}, warn: () => {} },
    eventBus: {
      publish: async (e: any) => { events.push(e); },
      _events: events,
    },
    memoryStore: {
      get: async (ns: string, key: string) => store.has(`${ns}:${key}`) ? { value: store.get(`${ns}:${key}`) } : undefined,
      set: async (ns: string, key: string, value: any) => { store.set(`${ns}:${key}`, value); },
      _store: store,
    },
    registry: { has: () => false, resolve: () => null },
    ...overrides,
  };
}

function makeControlRequest(action: ControlAction, overrides: Partial<ControlRequest> = {}): ControlRequest {
  return {
    id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    action,
    targetWorkflowId: "test-workflow",
    targetStage: "generation",
    timestamp: new Date(),
    requester: "FOUNDER",
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function runTests(): Promise<void> {
  console.log("=== START SPRINT 15.2 CONTROL CENTER TESTS ===\n");

  // ==========================================================================
  // 1. Builder Validation
  // ==========================================================================
  console.log("1. Builder Validation...");
  try {
    new ControlCenterBuilder().build();
    throw new Error("Expected ControlValidationException");
  } catch (err: unknown) {
    assert(err instanceof ControlValidationException, "Builder without context must throw ControlValidationException");
  }
  const builder = new ControlCenterBuilder().withContext(makeContext()).withMetadata({ sprint: "15.2" });
  const eng1 = builder.build();
  assert(eng1 instanceof ControlCenterEngine, "Builder must construct ControlCenterEngine");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 2. Lifecycle Transitions
  // ==========================================================================
  console.log("2. Lifecycle Transitions...");
  const eng2 = new ControlCenterEngine(makeContext());
  assert(eng2.state === ControlCenterState.CREATED, "Initial state must be CREATED");
  await eng2.initialize();
  assert(eng2.state === ControlCenterState.INITIALIZED, "State must transition to INITIALIZED");
  await eng2.start();
  assert(eng2.state === ControlCenterState.MONITORING, "State must transition to MONITORING");
  await eng2.pause();
  assert(eng2.state === ControlCenterState.PAUSED, "State must transition to PAUSED");
  await eng2.resume();
  assert(eng2.state === ControlCenterState.ACTIVE, "State must transition to ACTIVE");
  await eng2.stop();
  assert(eng2.state === ControlCenterState.FAILED, "State must transition to FAILED");

  // Invalid state transition
  try {
    ControlCenterValidator.validateStateTransition("test", ControlCenterState.CREATED, ControlCenterState.ACTIVE);
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof ControlValidationException, "Invalid transition must fail validation");
  }
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 3. Manual Override
  // ==========================================================================
  console.log("3. Manual Override...");
  const eng3 = new ControlCenterEngine(makeContext());
  const ovMgr = eng3.getOverrideManager();
  const override: ManualOverride = {
    id: "ov-1", workflowId: "wf-1", stageName: "generation",
    type: OverrideType.MANUAL, overriddenData: { temp: 0.9 },
    reason: "Increase creativity", appliedBy: "founder", appliedAt: new Date(), active: true,
  };
  ovMgr.applyOverride(override);
  const fetched = ovMgr.getOverride("ov-1");
  assert(fetched !== undefined, "Override must be retrievable");
  assert(fetched?.overriddenData.temp === 0.9, "Data payload must be preserved");

  const activeOverrides = ovMgr.getActiveOverrides("wf-1");
  assert(activeOverrides.length === 1, "Must filter active overrides by workflow");

  ovMgr.removeOverride("ov-1");
  assert(ovMgr.getActiveOverrides().length === 0, "Removing override should leave list empty");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 4. Pause Workflow
  // ==========================================================================
  console.log("4. Pause Workflow...");
  const eng4 = new ControlCenterEngine(makeContext());
  await eng4.initialize();
  await eng4.start();
  const reqPause = makeControlRequest(ControlAction.PAUSE, { targetWorkflowId: "workflow-A" });
  const respPause = await eng4.execute(reqPause);
  assert(respPause.success, "Pause command execution should be successful");
  assert(eng4.getExecutionController().isLocked("workflow-A"), "Paused workflow must acquire execution lock");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 5. Resume Workflow
  // ==========================================================================
  console.log("5. Resume Workflow...");
  const eng5 = new ControlCenterEngine(makeContext());
  await eng5.initialize();
  await eng5.start();
  await eng5.execute(makeControlRequest(ControlAction.PAUSE, { targetWorkflowId: "workflow-B" }));
  assert(eng5.getExecutionController().isLocked("workflow-B"), "Locked check before resume");

  const respResume = await eng5.execute(makeControlRequest(ControlAction.RESUME, { targetWorkflowId: "workflow-B" }));
  assert(respResume.success, "Resume action should be successful");
  assert(!eng5.getExecutionController().isLocked("workflow-B"), "Resumed workflow must release execution lock");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 6. Emergency Stop
  // ==========================================================================
  console.log("6. Emergency Stop...");
  const eng6 = new ControlCenterEngine(makeContext());
  const emerMgr = eng6.getEmergencyManager();
  const stop = emerMgr.trigger(EmergencyLevel.CRITICAL, "GPU overheat", "sensor");
  assert(stop.active, "Emergency stop should be active immediately");
  assert(emerMgr.getActiveStops().length === 1, "Must list active emergency stops");
  assert(stop.snapshotId !== undefined, "Emergency stop must trigger a recovery snapshot");

  const snapshot = emerMgr.getSnapshot(stop.snapshotId!);
  assert(snapshot !== undefined, "Snapshot must be retrievable");
  assert(snapshot?.systemHealthScore === 80, "Snapshot state metadata preserved");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 7. Recovery System
  // ==========================================================================
  console.log("7. Recovery System...");
  const eng7 = new ControlCenterEngine(makeContext());
  const emerMgr7 = eng7.getEmergencyManager();
  const stop7 = emerMgr7.trigger(EmergencyLevel.CRITICAL, "Crashed GPU core", "admin");
  assert(emerMgr7.getActiveStops().length === 1, "Trigger stop7");

  emerMgr7.recover(stop7.id, "founder");
  assert(emerMgr7.getActiveStops().length === 0, "System must recover cleanly and set stop status to inactive");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 8. Budget Monitoring
  // ==========================================================================
  console.log("8. Budget Monitoring...");
  const eng8 = new ControlCenterEngine(makeContext());
  const budMgr = eng8.getBudgetManager();
  const state8 = budMgr.recordUsage("OpenAI", 5.0);
  assert(state8 === BudgetState.NORMAL, "Budget state should be NORMAL for low usage");

  const usage8 = budMgr.getUsage("OpenAI");
  assert(usage8?.usedUsd === 5.0, "Used amount must accumulate correctly");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 9. Budget Blocking
  // ==========================================================================
  console.log("9. Budget Blocking...");
  const eng9 = new ControlCenterEngine(makeContext());
  const budMgr9 = eng9.getBudgetManager();
  budMgr9.setLimit({ providerName: "Runway", limitUsd: 10, alertThresholdPercent: 80, active: true });

  const stateWarn = budMgr9.recordUsage("Runway", 8.5);
  assert(stateWarn === BudgetState.WARNING, "Should trigger BudgetState.WARNING at 85%");

  const stateReached = budMgr9.recordUsage("Runway", 2.0);
  assert(stateReached === BudgetState.LIMIT_REACHED, "Should trigger BudgetState.LIMIT_REACHED when usage exceeds limit");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 10. Founder Approval
  // ==========================================================================
  console.log("10. Founder Approval...");
  const eng10 = new ControlCenterEngine(makeContext());
  const appMgr = eng10.getApprovalManager();
  const request: ApprovalRequest = {
    id: "app-req-1", title: "Render large output", description: "Estimate $15.00",
    costEstimateUsd: 15.00, category: "RENDERING", requestedBy: "RenderEngine",
    requestedAt: new Date(), status: "PENDING",
  };
  const pending = appMgr.requestApproval(request);
  assert(pending.lockId === "lock-app-req-1", "Should set execution lock boundary");
  assert(appMgr.getPending().length === 1, "Must list pending approval request");

  appMgr.grantApproval("app-req-1", "founder");
  const approvedReq = appMgr.getRequest("app-req-1");
  assert(approvedReq?.status === "APPROVED", "Status must update to APPROVED");
  assert(approvedReq?.decidedBy === "founder", "Must record decision authority");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 11. Notification Center
  // ==========================================================================
  console.log("11. Notification Center...");
  const eng11 = new ControlCenterEngine(makeContext());
  const notifMgr = eng11.getNotificationManager();
  const n1 = notifMgr.createNotification(NotificationPriority.HIGH, "Cost alert", "Prompt tokens limit", "BUDGET");
  const n2 = notifMgr.createNotification(NotificationPriority.CRITICAL, "Emergency Stop", "Fatal shutdown", "EMERGENCY");

  assert(notifMgr.getUnread().length === 2, "Unread count must be 2");
  const grouped = notifMgr.getGrouped();
  assert(grouped.length === 2, "Grouped notifications should list 2 distinct categories");

  notifMgr.markRead(n1.id);
  assert(notifMgr.getUnread("BUDGET").length === 0, "Read category count becomes 0");
  assert(notifMgr.getUnread().length === 1, "Overall unread count becomes 1");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 12. Permission Engine
  // ==========================================================================
  console.log("12. Permission Engine...");
  const eng12 = new ControlCenterEngine(makeContext());
  const permMgr = eng12.getPermissionManager();
  const rule: ExecutionPermissionRule = {
    id: "prule-1", workflowId: "wf-publish", action: ControlAction.START,
    permission: ExecutionPermission.FOUNDER_ONLY,
  };
  permMgr.setRule(rule);
  const resultPerm = permMgr.checkPermission("wf-publish", ControlAction.START);
  assert(resultPerm === ExecutionPermission.FOUNDER_ONLY, "Must enforce permission check");

  const rulesList = permMgr.getRules("wf-publish");
  assert(rulesList.length === 1, "Must retrieve rules by workflow ID");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 13. Execution Controller
  // ==========================================================================
  console.log("13. Execution Controller...");
  const eng13 = new ControlCenterEngine(makeContext());
  const execCtrl = eng13.getExecutionController();
  const lock = execCtrl.acquireLock("wf-generate", "AI script manager", "Prevent double post");
  assert(execCtrl.isLocked("wf-generate"), "Acquired lock should lock workflow");

  execCtrl.releaseLock(lock.id);
  assert(!execCtrl.isLocked("wf-generate"), "Releasing lock should free workflow");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 14. Memory Integration
  // ==========================================================================
  console.log("14. Memory Integration...");
  const ctx14 = makeContext();
  const eng14 = new ControlCenterEngine(ctx14);
  await eng14.initialize();
  await eng14.start();
  const req14 = makeControlRequest(ControlAction.PAUSE, { id: "req-mem-A" });
  await eng14.execute(req14);

  const memStore = ctx14.memoryStore._store as Map<string, any>;
  assert(memStore.has("control-center:state:req-mem-A"), "Must write ControlCenterState to memory");
  assert(memStore.has("workflow-locks:locks:req-mem-A"), "Must write workflow-locks namespace to memory");
  assert(memStore.has("budget:report:req-mem-A"), "Must write budget namespace usage to memory");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 15. Planning Integration
  // ==========================================================================
  console.log("15. Planning Integration...");
  let planningTaskCreated = false;
  const ctx15 = makeContext({
    planningEngine: {
      createTask: async (task: any) => {
        planningTaskCreated = true;
        assert(task.type === "CONTROL_CENTER_ACTION_COMPLETE", "Planning task type must match Action Completion");
        assert(task.action === ControlAction.RESUME, "Planning task action payload must match requested action");
      },
    },
  });
  const eng15 = new ControlCenterEngine(ctx15);
  await eng15.initialize();
  await eng15.start();
  await eng15.execute(makeControlRequest(ControlAction.RESUME, { id: "req-plan-A" }));
  assert(planningTaskCreated, "Planning task must be created after execution completes");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 16. Decision Integration
  // ==========================================================================
  console.log("16. Decision Integration...");
  let decisionRecorded = false;
  const ctx16 = makeContext({
    decisionEngine: {
      record: async (data: any) => {
        decisionRecorded = true;
        assert(data.controlCenterRequestId === "req-decision-A", "Decision record must contain Control Request ID");
        assert(data.action === ControlAction.STOP, "Decision record must preserve requested Action");
      },
    },
  });
  const eng16 = new ControlCenterEngine(ctx16);
  await eng16.initialize();
  await eng16.start();
  await eng16.execute(makeControlRequest(ControlAction.STOP, { id: "req-decision-A" }));
  assert(decisionRecorded, "Decision record must be logged after execution");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 17. Founder Integration
  // ==========================================================================
  console.log("17. Founder Integration...");
  const ctx17 = makeContext();
  const eng17 = new ControlCenterEngine(ctx17);
  await eng17.initialize();
  await eng17.start();
  const resp17 = await eng17.execute(makeControlRequest(ControlAction.PAUSE, { targetWorkflowId: "wf-founder" }));
  assert(resp17.snapshot !== undefined, "Control execution response must supply snapshot state for dashboard updates");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 18. Event Publishing
  // ==========================================================================
  console.log("18. Event Publishing...");
  const ctx18 = makeContext();
  const eng18 = new ControlCenterEngine(ctx18);
  await eng18.initialize();
  await eng18.start();
  await eng18.execute(makeControlRequest(ControlAction.PAUSE, { targetWorkflowId: "wf-event" }));
  await eng18.execute(makeControlRequest(ControlAction.RESUME, { targetWorkflowId: "wf-event" }));

  const evtNames = (ctx18.eventBus._events as any[]).map(e => e.name);
  assert(evtNames.includes("ControlStarted"), "ControlStarted event must be published");
  assert(evtNames.includes("WorkflowPaused"), "WorkflowPaused event must be published");
  assert(evtNames.includes("WorkflowResumed"), "WorkflowResumed event must be published");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 19. Snapshot Immutability
  // ==========================================================================
  console.log("19. Snapshot Immutability...");
  const eng19 = new ControlCenterEngine(makeContext());
  await eng19.initialize();
  const snapshot19 = eng19.getSnapshot();
  assert(Object.isFrozen(snapshot19), "ControlSnapshot object root must be frozen");

  let mutationFailed = false;
  try { (snapshot19 as any).state = "injectedState" as any; } catch (_) { mutationFailed = true; }
  assert(snapshot19.state === ControlCenterState.INITIALIZED || mutationFailed, "Snapshot state should be immutable");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 20. Full End-to-End Control Workflow
  // ==========================================================================
  console.log("20. Full End-to-End Control Workflow...");

  let e2eDecisionCalled = false;
  let e2ePlanningCalled = false;
  const ctxE2E = makeContext({
    decisionEngine: { record: async () => { e2eDecisionCalled = true; } },
    planningEngine: { createTask: async () => { e2ePlanningCalled = true; } },
  });

  const engE2E = new ControlCenterBuilder()
    .withContext(ctxE2E)
    .withMetadata({ mode: "e2e" })
    .build();

  // Setup: Initialize and start monitoring
  await engE2E.initialize();
  await engE2E.start();
  assert(engE2E.state === ControlCenterState.MONITORING, "E2E: Should start monitoring");

  // Step 1: Enforce permission rule
  const permE2E = engE2E.getPermissionManager();
  permE2E.setRule({ id: "rule-1", workflowId: "wf-e2e", action: ControlAction.ROLLBACK, permission: ExecutionPermission.FOUNDER_ONLY });

  // Step 2: Trigger Manual override
  const overE2E = engE2E.getOverrideManager();
  overE2E.applyOverride({
    id: "ov-e2e", workflowId: "wf-e2e", stageName: "rendering", type: OverrideType.FORCE,
    overriddenData: { engineSpeed: "max" }, reason: "Accelerate rendering", appliedBy: "founder",
    appliedAt: new Date(), active: true,
  });

  // Step 3: Record budget usage
  const budE2E = engE2E.getBudgetManager();
  budE2E.setLimit({ providerName: "ElevenLabs", limitUsd: 50, alertThresholdPercent: 75, active: true });
  const bState = budE2E.recordUsage("ElevenLabs", 40);
  assert(bState === BudgetState.WARNING, "E2E: ElevenLabs should reach WARNING state");

  // Step 4: Request Founder Approval
  const appE2E = engE2E.getApprovalManager();
  const pendingE2E = appE2E.requestApproval({
    id: "approval-e2e", title: "Approve custom Runway run", description: "Estimate $12.00",
    category: "GENERATION", requestedBy: "GenerationEngine", requestedAt: new Date(), status: "PENDING",
  });
  appE2E.grantApproval("approval-e2e", "founder");

  // Step 5: Execute actions
  const reqPauseE2E = makeControlRequest(ControlAction.PAUSE, { targetWorkflowId: "wf-e2e", id: "req-e2e-pause" });
  await engE2E.execute(reqPauseE2E);

  const reqResumeE2E = makeControlRequest(ControlAction.RESUME, { targetWorkflowId: "wf-e2e", id: "req-e2e-resume" });
  await engE2E.execute(reqResumeE2E);

  // Validate state
  const reportE2E = engE2E.getReport();
  assert(reportE2E.metrics.totalOverridesCount === 1, "E2E: Metrics should show 1 manual override");
  assert(reportE2E.budgetReport.totalBudgetUsedUsd === 40, "E2E: Budget usages accumulated");
  assert(e2eDecisionCalled, "E2E: Decision engine integration called");
  assert(e2ePlanningCalled, "E2E: Planning engine integration called");

  console.log("✓ Passed.\n");

  console.log("=== ALL 20/20 CONTROL CENTER TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch(err => {
  console.error("Test suite execution failed:", err);
  process.exit(1);
});
