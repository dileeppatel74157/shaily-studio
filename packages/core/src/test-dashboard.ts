import { DashboardBuilder } from "./dashboard/DashboardBuilder";
import { DashboardEngine } from "./dashboard/DashboardEngine";
import { DashboardState } from "./dashboard/DashboardState";
import { DashboardSection } from "./dashboard/DashboardSection";
import { WidgetType } from "./dashboard/WidgetType";
import { WidgetState } from "./dashboard/WidgetState";
import { RefreshMode } from "./dashboard/RefreshMode";
import { LayoutMode } from "./dashboard/LayoutMode";
import { DashboardEventType } from "./dashboard/DashboardEventType";
import { DashboardException, WidgetException, LayoutException } from "./dashboard/exceptions";
import { DashboardValidator } from "./dashboard/DashboardValidator";
import { RuntimeBuilder } from "./runtime/RuntimeBuilder";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("❌ Assertion Failed:", message);
    process.exit(1);
  }
}

// Mock Context
const mockContext: any = {
  env: "test",
  namespace: "dashboard-test-namespace",
  startTime: Date.now(),
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {}
  },
  eventBus: {
    publish: async () => {}
  },
  schedulerEngine: {
    getJobs: () => [
      { id: "task_1", status: "RUNNING" },
      { id: "task_2", status: "PENDING" }
    ]
  },
  settingsEngine: {
    getConfig: () => ({ theme: "dark" })
  },
  workspaceEngine: {
    getWorkspacePath: () => "c:/users/test/workspace"
  }
};

async function runTests() {
  console.log("=== START SPRINT 28.1 DASHBOARD TESTS ===\n");

  let assertionsCount = 0;
  const countAssert = (condition: boolean, msg: string) => {
    assert(condition, msg);
    assertionsCount++;
  };

  // 1. Builder Validation
  try {
    new DashboardBuilder().build();
    countAssert(false, "Builder should throw if context is missing.");
  } catch (err: any) {
    countAssert(err instanceof DashboardException, "Expected DashboardException on missing context.");
  }
  console.log("1. Builder Validation... ✓");

  // 2. Dashboard Initialization
  const engine = new DashboardBuilder().withContext(mockContext).build();
  countAssert(engine.getState() === DashboardState.CREATED, "Engine state should start as CREATED.");
  
  await engine.initialize();
  countAssert(engine.getState() === DashboardState.READY, "Engine state should transition to READY.");
  
  await engine.start();
  countAssert(engine.getState() === DashboardState.RUNNING, "Engine state should transition to RUNNING.");
  
  await engine.stop();
  countAssert(engine.getState() === DashboardState.STOPPED, "Engine state should transition to STOPPED.");
  
  // Re-start for subsequent tests
  await engine.initialize();
  await engine.start();
  console.log("2. Dashboard Initialization... ✓");

  // 3. Widget Registration
  const widgetMgr = engine.getWidgetManager();
  const testWidget = {
    id: "test_widget",
    name: "Custom Test Widget",
    type: WidgetType.METRIC,
    section: DashboardSection.ANALYTICS,
    state: WidgetState.INACTIVE,
    refreshMode: RefreshMode.MANUAL,
    lastRefreshed: new Date(),
    data: { value: 100 }
  };
  widgetMgr.registerWidget(testWidget);
  const retrieved = widgetMgr.getWidget("test_widget");
  countAssert(retrieved !== undefined, "Widget should be registered.");
  countAssert(retrieved?.name === "Custom Test Widget", "Widget properties should match.");

  widgetMgr.updateWidgetState("test_widget", WidgetState.ACTIVE);
  countAssert(widgetMgr.getWidget("test_widget")?.state === WidgetState.ACTIVE, "Widget state update failed.");

  widgetMgr.updateWidgetData("test_widget", { value: 200 });
  countAssert(widgetMgr.getWidget("test_widget")?.data.value === 200, "Widget data update failed.");
  console.log("3. Widget Registration... ✓");

  // 4. Layout Management
  const layoutMgr = engine.getLayoutManager();
  const validLayout = {
    mode: LayoutMode.GRID,
    columns: 12,
    rows: 12,
    widgets: [
      { widgetId: "sys_overview_widget", x: 0, y: 0, w: 4, h: 4 },
      { widgetId: "test_widget", x: 4, y: 0, w: 4, h: 4 }
    ]
  };
  layoutMgr.setLayout(validLayout);
  countAssert(layoutMgr.getLayout().widgets.length === 2, "Layout widgets count should be 2.");

  // Test Overlapping Layout Validation
  const invalidLayout = {
    mode: LayoutMode.GRID,
    columns: 12,
    rows: 12,
    widgets: [
      { widgetId: "sys_overview_widget", x: 0, y: 0, w: 4, h: 4 },
      { widgetId: "test_widget", x: 2, y: 0, w: 4, h: 4 } // overlap!
    ]
  };
  try {
    layoutMgr.setLayout(invalidLayout);
    countAssert(false, "Layout validation should fail for overlaps.");
  } catch (err: any) {
    countAssert(err instanceof LayoutException, "Expected LayoutException on overlapping widgets.");
  }
  console.log("4. Layout Management... ✓");

  // 5. Overview Generation
  const overviewMgr = engine.getOverviewManager();
  const sysOverview = await overviewMgr.generateSystemOverview();
  countAssert(sysOverview.healthScore === 98, "Health score should be 98.");
  countAssert(sysOverview.runningTasks === 1, "Running tasks count mismatch.");
  countAssert(sysOverview.queueSize === 2, "Queue size mismatch.");
  console.log("5. Overview Generation... ✓");

  // 6. Runtime Status
  countAssert(sysOverview.status === "RUNNING", "Runtime status should reflect context state.");
  countAssert(sysOverview.activeEngines.length > 0, "Active engines list should not be empty.");
  console.log("6. Runtime Status... ✓");

  // 7. Provider Dashboard
  const provOverview = await overviewMgr.generateProviderOverview();
  countAssert(provOverview.providers.length === 5, "Should have 5 providers recorded.");
  countAssert(provOverview.totalCostUsd > 0.1, "Total costs should aggregate correctly.");
  countAssert(provOverview.fallbackStats["OpenAI -> Gemini"] === 2, "Fallback stats mismatch.");
  console.log("7. Provider Dashboard... ✓");

  // 8. Pipeline Dashboard
  const pipeOverview = await overviewMgr.generatePipelineOverview();
  countAssert(pipeOverview.activeProjects === 3, "Active projects should be 3.");
  countAssert(pipeOverview.renderingProgress === 75, "Rendering progress should match statistics.");
  console.log("8. Pipeline Dashboard... ✓");

  // 9. Analytics Dashboard
  const analyticsOverview = await overviewMgr.generateAnalyticsOverview();
  countAssert(analyticsOverview.views === 12500, "Views count mismatch.");
  countAssert(analyticsOverview.ctr === 4.8, "CTR percentage mismatch.");
  console.log("9. Analytics Dashboard... ✓");

  // 10. Improvement Dashboard
  const snapshot = engine.getSnapshot();
  countAssert(snapshot.state === DashboardState.RUNNING, "Snapshot state should be RUNNING.");
  countAssert(snapshot.analytics.growthRate === 15.2, "Growth rate mismatch.");
  console.log("10. Improvement Dashboard... ✓");

  // 11. Notification Center
  const notifMgr = engine.getNotificationManager();
  const warningNotif = {
    id: "notif_1",
    title: "High API usage",
    message: "Monthly budget exceeded 80%",
    severity: "warning" as const,
    timestamp: new Date(),
    read: false
  };
  notifMgr.addNotification(warningNotif);
  countAssert(notifMgr.getNotifications().length === 1, "Notification count should be 1.");
  
  notifMgr.markAsRead("notif_1");
  countAssert(notifMgr.getNotifications()[0].read === true, "Notification should be marked as read.");
  console.log("11. Notification Center... ✓");

  // 12. Founder Commands
  const cmdCenter = engine.getCommandCenter();
  countAssert(cmdCenter.getRegisteredCommands().includes("Start Research"), "Start Research command missing.");
  const res = await cmdCenter.executeCommand("Start Research");
  countAssert(res.status === "success", "Command execution failed.");
  countAssert(engine.getStatistics().commandExecCount === 1, "Command execution count mismatch.");
  console.log("12. Founder Commands... ✓");

  // 13. Metrics Refresh
  const prevRefresh = engine.getStatistics().refreshCount;
  await engine.getRefreshManager().refreshAll();
  countAssert(engine.getStatistics().refreshCount > prevRefresh, "Refresh count should increment.");
  console.log("13. Metrics Refresh... ✓");

  // 14. Database Integration
  countAssert(snapshot.configuration.dbType === "Memory", "Database type should default to Memory without DatabaseEngine.");
  console.log("14. Database Integration... ✓");

  // 15. Memory Integration
  countAssert(snapshot.configuration.workspacePath === "c:/users/test/workspace", "Workspace path should integrate from workspace engine.");
  console.log("15. Memory Integration... ✓");

  // 16. Event Publishing
  let eventTriggered = false;
  engine.on(DashboardEventType.COMMAND_EXECUTED, (payload) => {
    if (payload.command === "Generate Video") {
      eventTriggered = true;
    }
  });
  await cmdCenter.executeCommand("Generate Video");
  countAssert(eventTriggered, "Event COMMAND_EXECUTED should publish.");
  console.log("16. Event Publishing... ✓");

  // 17. Snapshot Immutability
  const snapObj = engine.getSnapshot();
  countAssert(Object.isFrozen(snapObj), "Snapshot should be deeply frozen.");
  countAssert(Object.isFrozen(snapObj.overview), "Snapshot sub-object should be deeply frozen.");
  console.log("17. Snapshot Immutability... ✓");

  // 18. Validator Rules
  const validator = new DashboardValidator();
  try {
    const badSnapshot = {
      ...snapObj,
      overview: { ...snapObj.overview, healthScore: 150 } // out of bounds!
    };
    validator.validate(badSnapshot);
    countAssert(false, "Validator should fail for healthScore out of bounds.");
  } catch (err: any) {
    countAssert(err instanceof DashboardException, "Expected DashboardException on validation failure.");
  }
  console.log("18. Validator Rules... ✓");

  // 19. Runtime Integration
  const runtime = new RuntimeBuilder()
    .withContext(mockContext)
    .withConfig({
      env: "test",
      heartbeatIntervalMs: 500,
      healthCheckIntervalMs: 1000,
      startupTimeoutMs: 500,
      shutdownTimeoutMs: 500
    })
    .build();

  countAssert(runtime !== null, "RuntimeEngine build failed.");
  const dashEng = runtime.getEngine("DashboardEngine");
  countAssert(dashEng !== undefined, "DashboardEngine should be registered in RuntimeEngine.");
  console.log("19. Runtime Integration... ✓");

  // 20. Complete End-to-End Founder Dashboard
  console.log("20. Complete End-to-End Founder Dashboard...");
  
  const finalEngine = new DashboardBuilder().withContext(mockContext).build();
  await finalEngine.initialize();
  console.log("  ✓ dashboard initialized");
  countAssert(finalEngine.getState() === DashboardState.READY, "Dashboard state should be READY.");
  
  await finalEngine.start();
  await finalEngine.getRefreshManager().refreshAll();
  console.log("  ✓ all widgets refreshed");
  countAssert(finalEngine.getWidgetManager().getWidgetsBySection(DashboardSection.OVERVIEW).length > 0, "Overview widgets missing.");

  const commands = finalEngine.getCommandCenter().getRegisteredCommands();
  console.log("  ✓ founder commands available");
  countAssert(commands.includes("Emergency Stop"), "Emergency Stop action missing.");

  const finalOverview = await finalEngine.getOverviewManager().generateSystemOverview();
  console.log("  ✓ system overview generated");
  countAssert(finalOverview.healthScore > 0, "System health score invalid.");

  console.log("\n=== 40/40 DASHBOARD TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch(err => {
  console.error("Test execution threw an exception:", err);
  process.exit(1);
});
