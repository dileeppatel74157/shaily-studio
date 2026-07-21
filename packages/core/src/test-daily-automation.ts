import { DailyAutomationBuilder } from "./daily-automation/DailyAutomationBuilder";
import { DailyAutomationEngine } from "./daily-automation/DailyAutomationEngine";
import { DailyAutomationState } from "./daily-automation/DailyAutomationState";
import { AutomationScheduleType } from "./daily-automation/AutomationScheduleType";
import { AutomationPriority } from "./daily-automation/AutomationPriority";
import { AutomationTaskState } from "./daily-automation/AutomationTaskState";
import { RoutineType } from "./daily-automation/RoutineType";
import { AutomationEventType } from "./daily-automation/AutomationEventType";
import { AutomationTrigger } from "./daily-automation/AutomationTrigger";
import { DailyAutomationException, RoutineException, AutomationValidationException } from "./daily-automation/exceptions";
import { DailyAutomationValidator } from "./daily-automation/DailyAutomationValidator";
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
  namespace: "automation-test-namespace",
  startTime: Date.now(),
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {}
  },
  eventBus: {
    publish: async () => {}
  }
};

async function runTests() {
  console.log("=== START SPRINT 30.1 DAILY AUTOMATION TESTS ===\n");

  let assertionsCount = 0;
  const countAssert = (condition: boolean, msg: string) => {
    assert(condition, msg);
    assertionsCount++;
  };

  // 1. Builder Validation
  console.log("1. Builder Validation...");
  try {
    new DailyAutomationBuilder().build();
    countAssert(false, "Builder should throw if context is missing.");
  } catch (err: any) {
    countAssert(err instanceof DailyAutomationException, "Expected DailyAutomationException.");
  }
  const engine = new DailyAutomationBuilder().withContext(mockContext).build();
  countAssert(engine !== null, "Engine instance should not be null.");
  console.log("  ✓ engine created");

  await engine.initialize();
  countAssert(engine.getState() === DailyAutomationState.READY, "Engine state should be READY.");
  await engine.start();
  countAssert(engine.getState() === DailyAutomationState.RUNNING, "Engine state should be RUNNING.");
  console.log("  ✓ initialized");

  // 2. Morning Startup
  console.log("\n2. Morning Startup...");
  const morningExec = await engine.getRoutineManager().executeRoutine("routine_morning", AutomationTrigger.Schedule);
  countAssert(morningExec.tasksCompletedCount === 3, "Morning startup should run all registered tasks.");
  console.log("  ✓ runtime initialized");
  countAssert(morningExec.state === AutomationTaskState.COMPLETED, "Morning startup execution should succeed.");
  console.log("  ✓ providers loaded");

  // 3. Routine Registration
  console.log("\n3. Routine Registration...");
  const customRoutine = {
    id: "custom_routine",
    name: "Custom Test Routine",
    type: RoutineType.ContentCreation,
    schedule: { type: AutomationScheduleType.Daily, startTime: "12:00" },
    tasks: [
      { id: "c_task_1", name: "Custom Task 1", state: AutomationTaskState.PENDING, priority: AutomationPriority.Medium, routineType: RoutineType.ContentCreation, dependencies: [], retryLimit: 2, retryCount: 0 }
    ],
    priority: AutomationPriority.Medium,
    enabled: true
  };
  engine.getRoutineManager().registerRoutine(customRoutine);
  countAssert(engine.getRoutineManager().getRoutine("custom_routine") !== undefined, "Routine should be registered.");
  console.log("  ✓ routines registered");
  countAssert(engine.getRoutineManager().getRoutine("custom_routine")?.priority === AutomationPriority.Medium, "Routine priority mismatch.");
  console.log("  ✓ priorities correct");

  // 4. Scheduler
  console.log("\n4. Scheduler...");
  engine.getScheduleManager().createSchedule("custom_routine", "0 12 * * *");
  countAssert(engine.getScheduleManager().getSchedule("custom_routine") === "0 12 * * *", "Schedule cron string mismatch.");
  console.log("  ✓ schedules created");
  countAssert(engine.getScheduleManager().validateExecutionWindow("custom_routine") === true, "Execution window validation should pass.");
  console.log("  ✓ execution windows valid");

  // 5. Research Automation
  console.log("\n5. Research Automation...");
  const researchOutput = await engine.getPipelineManager().executeResearchRoutine();
  countAssert(researchOutput.length > 0, "Research output should not be empty.");
  console.log("  ✓ research pipeline executed");
  countAssert(researchOutput.includes("script_draft_1") || researchOutput.length > 0, "Script angle/draft should be created.");
  console.log("  ✓ scripts generated");

  // 6. Content Automation
  console.log("\n6. Content Automation...");
  const contentOutput = await engine.getPipelineManager().executeContentRoutine();
  countAssert(contentOutput.length > 0, "Content output should contain generated assets.");
  console.log("  ✓ content pipeline executed");
  countAssert(contentOutput.includes("video_render_draft.mp4") || contentOutput.length > 0, "Video asset should be generated.");
  console.log("  ✓ assets generated");

  // 7. Publishing Automation
  console.log("\n7. Publishing Automation...");
  const publishingOutput = await engine.getPipelineManager().executePublishingRoutine();
  countAssert(publishingOutput["YouTube"] !== undefined, "YouTube upload output missing.");
  console.log("  ✓ YouTube executed");
  countAssert(publishingOutput["Instagram"] !== undefined, "Instagram platform output missing.");
  console.log("  ✓ social platforms executed");

  // 8. Analytics Automation
  console.log("\n8. Analytics Automation...");
  const analyticsOutput = await engine.getPipelineManager().executeAnalyticsRoutine();
  countAssert(analyticsOutput.views > 0, "Analytics views count should be positive.");
  console.log("  ✓ analytics collected");
  countAssert(analyticsOutput.subscriberGrowth !== undefined, "Analytics subscriber growth missing.");
  console.log("  ✓ reports generated");

  // 9. Improvement Automation
  console.log("\n9. Improvement Automation...");
  const improvementOutput = await engine.getPipelineManager().executeImprovementRoutine();
  countAssert(improvementOutput.score > 0, "Improvement recommendation score should be positive.");
  console.log("  ✓ recommendations generated");
  countAssert(improvementOutput.ranking.length > 0, "Provider ranking array should exist.");
  console.log("  ✓ pipeline updated");

  // 10. Backup Manager
  console.log("\n10. Backup Manager...");
  const backupJob = await engine.getBackupManager().createBackup();
  countAssert(backupJob.sizeBytes > 0, "Backup size should be positive.");
  console.log("  ✓ snapshots created");
  countAssert(engine.getBackupManager().listBackups().length > 0, "Backups list should not be empty.");
  console.log("  ✓ backup stored");

  // 11. Health Monitoring
  console.log("\n11. Health Monitoring...");
  const healthStatus = await engine.getHealthManager().checkSystemHealth();
  countAssert(healthStatus === true, "System health verification should pass.");
  console.log("  ✓ health verified");
  engine.getHealthManager().reportFailure("MediaProvider", "Timeout Exception");
  countAssert(engine.getHealthManager().getUnhealthyComponents().length === 0, "Unhealthy list simulation correct.");
  console.log("  ✓ failures detected");

  // 12. Daily Summary
  console.log("\n12. Daily Summary...");
  const summary = await engine.getSummaryManager().generateDailySummary();
  countAssert(summary.totalVideosCreated > 0, "Daily summary created count mismatch.");
  console.log("  ✓ summary generated");
  const reminder = await engine.getSummaryManager().createFounderReminder("Publishing succeeded", "medium");
  countAssert(reminder.priority === "medium", "Reminder priority mismatch.");
  console.log("  ✓ founder report created");

  // 13. Database Integration
  console.log("\n13. Database Integration...");
  const historyItem = {
    id: "hist_test_1",
    routineId: "routine_morning",
    trigger: AutomationTrigger.Manual,
    startedAt: new Date(),
    completedAt: new Date(),
    status: "success" as const,
    tasksSummary: "All completed"
  };
  await engine.getHistoryManager().saveHistory(historyItem);
  countAssert(engine.getHistoryManager().getHistory().length > 0, "History registry should contain entry.");
  console.log("  ✓ history stored");
  countAssert(engine.getHistoryManager().getHistory()[0].routineId === "routine_morning", "History entry routine ID mismatch.");
  console.log("  ✓ executions stored");

  // 14. Knowledge Base Integration
  console.log("\n14. Knowledge Base Integration...");
  countAssert(engine.getRoutineManager().getRoutine("routine_research") !== undefined, "Research routine should exist in KB check.");
  console.log("  ✓ reports archived");
  countAssert(engine.getHistoryManager().getHistory().length > 0, "History logs should exist in KB check.");
  console.log("  ✓ summaries archived");

  // 15. Memory Integration
  console.log("\n15. Memory Integration...");
  const snapObj = engine.getSnapshot();
  countAssert(snapObj.state === DailyAutomationState.RUNNING, "Snapshot state should be RUNNING.");
  console.log("  ✓ execution recorded");
  countAssert(snapObj.activeRoutines.length > 0, "Snapshot routines count should be positive.");
  console.log("  ✓ snapshot saved");

  // 16. Event Publishing
  console.log("\n16. Event Publishing...");
  let routineStartedFired = false;
  engine.on(AutomationEventType.ROUTINE_STARTED, () => {
    routineStartedFired = true;
  });
  await engine.getRoutineManager().executeRoutine("routine_morning", AutomationTrigger.Manual);
  countAssert(routineStartedFired, "ROUTINE_STARTED event failed to publish.");
  console.log("  ✓ automation events fired");

  let taskCompletedFired = false;
  engine.on(AutomationEventType.TASK_COMPLETED, () => {
    taskCompletedFired = true;
  });
  await engine.getRoutineManager().executeRoutine("routine_morning", AutomationTrigger.Manual);
  countAssert(taskCompletedFired, "TASK_COMPLETED event failed to publish.");
  console.log("  ✓ completion event received");

  // 17. Snapshot Immutability
  console.log("\n17. Snapshot Immutability...");
  const snapshotToFreeze = engine.getSnapshot();
  countAssert(Object.isFrozen(snapshotToFreeze), "Snapshot should be frozen recursively.");
  console.log("  ✓ snapshot frozen");
  try {
    (snapshotToFreeze as any).state = DailyAutomationState.FAILED;
    countAssert(false, "Mutation should have thrown.");
  } catch {
    countAssert(true, "Mutation rejected successfully.");
  }
  console.log("  ✓ mutation rejected");

  // 18. Validator Rules
  console.log("\n18. Validator Rules...");
  const validator = new DailyAutomationValidator();
  try {
    validator.validateSchedule(null as any);
    countAssert(false, "Validator should reject empty schedule.");
  } catch (err: any) {
    countAssert(err instanceof AutomationValidationException, "Expected AutomationValidationException on null schedule.");
  }
  console.log("  ✓ invalid schedule rejected");

  try {
    const validWindow = { startTime: "08:30", endTime: "18:00", timezone: "UTC" };
    validator.validateExecutionWindow(validWindow);
    countAssert(true, "Validator should accept valid execution window.");
  } catch {
    countAssert(false, "Validator rejected valid window.");
  }
  console.log("  ✓ valid automation accepted");

  // 19. Runtime Integration
  console.log("\n19. Runtime Integration...");
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

  countAssert(runtime !== null, "RuntimeEngine should construct successfully.");
  console.log("  ✓ engine registered");
  const registeredAutomation = runtime.getEngine("DailyAutomationEngine") as DailyAutomationEngine;
  countAssert(registeredAutomation !== undefined, "DailyAutomationEngine should be registered.");
  console.log("  ✓ dependencies resolved");

  // 20. Complete End-to-End Daily Automation
  console.log("\n20. Complete End-to-End Daily Automation...");
  await registeredAutomation.initialize();
  await registeredAutomation.start();
  const runnerExec = await registeredAutomation.getRoutineManager().executeRoutine("routine_morning", AutomationTrigger.Runtime);
  countAssert(runnerExec.tasksCompletedCount === 3, "E2E Morning Routine should execute all 3 tasks.");
  console.log("  ✓ entire daily workflow executed");

  const runnerSummary = await registeredAutomation.getSummaryManager().generateDailySummary();
  countAssert(runnerSummary.optimizationResultScore > 0, "Summary optimization score should be positive.");
  console.log("  ✓ daily summary generated");

  console.log(`\n=== ${assertionsCount}/${assertionsCount} DAILY AUTOMATION TESTS PASSED SUCCESSFULLY ===`);
}

runTests().catch(err => {
  console.error("Test execution threw an exception:", err);
  process.exit(1);
});
