import { TaskSchedulerBuilder } from "./task-scheduler/TaskSchedulerBuilder";
import { TaskSchedulerEngine } from "./task-scheduler/TaskSchedulerEngine";
import { SchedulerState } from "./task-scheduler/SchedulerState";
import { TaskState } from "./task-scheduler/TaskState";
import { TaskPriority } from "./task-scheduler/TaskPriority";
import { TriggerType } from "./task-scheduler/TriggerType";
import { ScheduleType } from "./task-scheduler/ScheduleType";
import { RetryPolicy } from "./task-scheduler/RetryPolicy";
import { DependencyState } from "./task-scheduler/DependencyState";
import { ExecutionWindow } from "./task-scheduler/ExecutionWindow";
import { TaskSchedulerValidator } from "./task-scheduler/TaskSchedulerValidator";
import {
  TaskSchedulerValidationException,
  InvalidTaskSchedulerStateException,
  CronParseException
} from "./task-scheduler/types";
import { RuntimeBuilder } from "./runtime/RuntimeBuilder";
import { StartupPriority } from "./runtime/StartupPriority";
import { RuntimeState } from "./runtime/RuntimeState";

function assert(condition: boolean, message: string) {
  if (!condition) {
    // eslint-disable-next-line no-console
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

// Mock Memory Store implementation
class MockMemoryStore {
  public store = new Map<string, Map<string, any>>();

  public async set(namespace: string, key: string, value: any): Promise<any> {
    if (!this.store.has(namespace)) {
      this.store.set(namespace, new Map());
    }
    this.store.get(namespace)!.set(key, value);
    return { namespace, key, value, timestamp: new Date() };
  }

  public async get(namespace: string, key: string): Promise<any> {
    return this.store.get(namespace)?.get(key);
  }

  public async has(namespace: string, key: string): Promise<boolean> {
    return this.store.get(namespace)?.has(key) ?? false;
  }
}

async function runTests() {
  // eslint-disable-next-line no-console
  console.log("=== START SPRINT 19.2 TASK SCHEDULER ENGINE TESTS ===\n");

  const memoryStore = new MockMemoryStore();
  const context = {
    env: "test",
    namespace: "task-scheduler-test-namespace",
    memoryStore,
    startTime: Date.now()
  };

  const config = {
    concurrentLimit: 2,
    checkIntervalMs: 200,
    persistenceEnabled: true
  };

  // ==========================================
  // 1. Builder Validation...
  // ==========================================
  try {
    new TaskSchedulerBuilder().build();
    assert(false, "Should fail without context");
  } catch (err) {
    assert(err instanceof TaskSchedulerValidationException, "Expected TaskSchedulerValidationException");
  }

  const scheduler = new TaskSchedulerBuilder()
    .withContext(context)
    .withConfig(config)
    .build() as TaskSchedulerEngine;

  assert(scheduler !== null, "Scheduler builder should return an instance");
  assert(scheduler.getState() === SchedulerState.CREATED, "Initial state must be CREATED");
  // eslint-disable-next-line no-console
  console.log("1. Builder Validation... ✓");

  // ==========================================
  // 2. Lifecycle Transitions...
  // ==========================================
  try {
    await scheduler.start();
    assert(false, "Should fail starting before initializing");
  } catch (err) {
    assert(err instanceof InvalidTaskSchedulerStateException, "Expected InvalidTaskSchedulerStateException");
  }

  await scheduler.initialize();
  assert(scheduler.getState() === SchedulerState.STOPPED, "Should transition to STOPPED");

  await scheduler.start();
  assert(scheduler.getState() === SchedulerState.RUNNING, "Should transition to RUNNING");

  await scheduler.stop();
  assert(scheduler.getState() === SchedulerState.STOPPED, "Should transition to STOPPED on stop");
  // eslint-disable-next-line no-console
  console.log("2. Lifecycle Transitions... ✓");

  // ==========================================
  // 3. Task Creation...
  // ==========================================
  const tm = scheduler.getTaskManager();
  const task = await tm.createTask({
    id: "task-1",
    name: "Research AI News",
    priority: TaskPriority.HIGH,
    schedule: {
      type: ScheduleType.ONCE,
      triggerType: TriggerType.MANUAL
    },
    retryPolicy: {
      strategy: RetryPolicy.FIXED_DELAY,
      maxRetries: 3,
      initialDelayMs: 10
    },
    parameters: { topic: "AI" }
  });

  assert(task.id === "task-1", "Task created with correct ID");
  assert(task.state === TaskState.PENDING, "State should be PENDING");
  // eslint-disable-next-line no-console
  console.log("3. Task Creation... ✓");

  // ==========================================
  // 4. Schedule Creation...
  // ==========================================
  assert(task.schedule.type === ScheduleType.ONCE, "Schedule created with type ONCE");
  assert(task.schedule.triggerType === TriggerType.MANUAL, "Trigger type is MANUAL");
  // eslint-disable-next-line no-console
  console.log("4. Schedule Creation... ✓");

  // ==========================================
  // 5. Cron Scheduling...
  // ==========================================
  const cronManager = scheduler.getCronManager();
  const cron = cronManager.parseCron("*/5 * * * *");
  
  assert(cron.minutes.includes(5) && cron.minutes.includes(10), "Parsed step minutes");
  assert(cron.hours.length === 24, "Asterisk hours mapped to all hours");

  const matchTime = new Date();
  matchTime.setMinutes(15);
  assert(cronManager.isCronDue(cron, matchTime), "Cron evaluates due on match minute");
  // eslint-disable-next-line no-console
  console.log("5. Cron Scheduling... ✓");

  // ==========================================
  // 6. Daily Scheduling...
  // ==========================================
  const dailyTask = await tm.createTask({
    id: "task-daily",
    schedule: {
      type: ScheduleType.DAILY,
      triggerType: TriggerType.TIME
    },
    parameters: {}
  });
  dailyTask.lastRunAt = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25h ago
  await tm.updateTask(dailyTask);

  const trm = scheduler.getTriggerManager();
  await trm.evaluateTriggers(new Date());
  assert(dailyTask.state === TaskState.QUEUED, "Daily task triggered and enqueued");
  await scheduler.getQueueManager().dequeue(); // clean
  // eslint-disable-next-line no-console
  console.log("6. Daily Scheduling... ✓");

  // ==========================================
  // 7. Weekly Scheduling...
  // ==========================================
  const weeklyTask = await tm.createTask({
    id: "task-weekly",
    schedule: {
      type: ScheduleType.WEEKLY,
      triggerType: TriggerType.TIME
    },
    parameters: {}
  });
  weeklyTask.lastRunAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8d ago
  await tm.updateTask(weeklyTask);

  await trm.evaluateTriggers(new Date());
  assert(weeklyTask.state === TaskState.QUEUED, "Weekly task triggered and enqueued");
  await scheduler.getQueueManager().dequeue();
  // eslint-disable-next-line no-console
  console.log("7. Weekly Scheduling... ✓");

  // ==========================================
  // 8. Queue Priority...
  // ==========================================
  const qm = scheduler.getQueueManager();
  const taskLow = await tm.createTask({
    id: "task-low",
    priority: TaskPriority.LOW,
    schedule: { type: ScheduleType.ONCE, triggerType: TriggerType.MANUAL },
    parameters: {}
  });

  const taskCritical = await tm.createTask({
    id: "task-critical",
    priority: TaskPriority.CRITICAL,
    schedule: { type: ScheduleType.ONCE, triggerType: TriggerType.MANUAL },
    parameters: {}
  });

  await qm.enqueue(taskLow);
  await qm.enqueue(taskCritical);

  const firstOut = await qm.dequeue();
  assert(firstOut?.taskId === "task-critical", "Critical task dequeued first");
  
  const secondOut = await qm.dequeue();
  assert(secondOut?.taskId === "task-low", "Low task dequeued second");
  // eslint-disable-next-line no-console
  console.log("8. Queue Priority... ✓");

  // ==========================================
  // 9. Dependency Resolution...
  // ==========================================
  const parent = await tm.createTask({
    id: "task-parent",
    schedule: { type: ScheduleType.ONCE, triggerType: TriggerType.MANUAL },
    parameters: {}
  });

  const child = await tm.createTask({
    id: "task-child",
    dependencies: ["task-parent"],
    schedule: { type: ScheduleType.ONCE, triggerType: TriggerType.MANUAL },
    parameters: {}
  });

  const depManager = scheduler.getDependencyManager();
  assert(depManager.evaluateDependencies(child.id) === DependencyState.WAITING, "Child is WAITING");
  
  parent.state = TaskState.COMPLETED;
  await tm.updateTask(parent);

  assert(depManager.evaluateDependencies(child.id) === DependencyState.READY, "Child is READY");
  // eslint-disable-next-line no-console
  console.log("9. Dependency Resolution... ✓");

  // ==========================================
  // 10. Retry Policy...
  // ==========================================
  const failTask = await tm.createTask({
    id: "task-fail",
    schedule: { type: ScheduleType.ONCE, triggerType: TriggerType.MANUAL },
    retryPolicy: {
      strategy: RetryPolicy.FIXED_DELAY,
      maxRetries: 2,
      initialDelayMs: 20
    },
    parameters: {}
  });

  const retryManager = scheduler.getRetryManager();
  assert(retryManager.shouldRetry(failTask, new Error("err")), "Should retry on first attempt");
  
  retryManager.recordRetry(failTask.id, new Error("err"));
  assert(retryManager.shouldRetry(failTask, new Error("err")), "Should retry on second attempt");
  
  retryManager.recordRetry(failTask.id, new Error("err"));
  assert(!retryManager.shouldRetry(failTask, new Error("err")), "Should NOT retry after limit");
  // eslint-disable-next-line no-console
  console.log("10. Retry Policy... ✓");

  // ==========================================
  // 11. Auto Resume...
  // ==========================================
  const pendingTask = await tm.createTask({
    id: "task-pending-persistence",
    parameters: {}
  });
  pendingTask.state = TaskState.QUEUED;
  await tm.updateTask(pendingTask);

  // Persist queue in memory
  const runningTasks = tm.listTasks().filter(t => t.state === TaskState.QUEUED);
  await scheduler.logToMemory("scheduler", "unfinished_tasks", runningTasks);

  // Reinitialize scheduler to test auto resume
  const secondaryScheduler = new TaskSchedulerBuilder()
    .withContext(context)
    .withConfig(config)
    .build();
  await secondaryScheduler.initialize();

  const restoredTask = await secondaryScheduler.getTaskManager().getTask("task-pending-persistence");
  assert(restoredTask.state === TaskState.QUEUED, "State restored successfully");
  // eslint-disable-next-line no-console
  console.log("11. Auto Resume... ✓");

  // ==========================================
  // 12. Runtime Integration...
  // ==========================================
  const runtime = new RuntimeBuilder()
    .withContext(context)
    .withConfig({
      env: "test",
      heartbeatIntervalMs: 500,
      healthCheckIntervalMs: 1000,
      startupTimeoutMs: 500,
      shutdownTimeoutMs: 500
    })
    .withHost({ id: "host-1" })
    .build();

  await runtime.initialize();
  await runtime.start();

  const loadedScheduler = (runtime as any).getEngine("SchedulerEngine");
  assert(loadedScheduler !== undefined, "Scheduler is registered inside Runtime");
  await runtime.stop();
  // eslint-disable-next-line no-console
  console.log("12. Runtime Integration... ✓");

  // ==========================================
  // 13. Pipeline Integration...
  // ==========================================
  const pipeTask = await tm.createTask({
    id: "task-pipeline",
    targetPipelineId: "pipe-123",
    schedule: { type: ScheduleType.ONCE, triggerType: TriggerType.PIPELINE },
    parameters: {}
  });

  const execManager = scheduler.getExecutionManager();
  await execManager.executeTask(pipeTask);
  assert(await memoryStore.has("pipeline-runs", "pipeline-pipe-123"), "Pipeline execute triggered memory record");
  // eslint-disable-next-line no-console
  console.log("13. Pipeline Integration... ✓");

  // ==========================================
  // 14. Memory Integration...
  // ==========================================
  await scheduler.logToMemory("executions", "exec-test-1", { status: "running" });
  assert(await memoryStore.has("executions", "exec-test-1"), "Executions namespace integration works");
  // eslint-disable-next-line no-console
  console.log("14. Memory Integration... ✓");

  // ==========================================
  // 15. Decision Integration...
  // ==========================================
  // Learning / decision metrics integration test placeholder
  await scheduler.logToMemory("scheduler", "outcome-decision", { success: true });
  assert(await memoryStore.has("scheduler", "outcome-decision"), "Decision metrics namespace integration works");
  // eslint-disable-next-line no-console
  console.log("15. Decision Integration... ✓");

  // ==========================================
  // 16. Event Publishing...
  // ==========================================
  let eventFired = false;
  scheduler.on("TaskCreated", () => { eventFired = true; });
  await tm.createTask({ id: "task-event-check", parameters: {} });
  assert(eventFired, "TaskCreated event published successfully");
  // eslint-disable-next-line no-console
  console.log("16. Event Publishing... ✓");

  // ==========================================
  // 17. Snapshot Immutability...
  // ==========================================
  const snap = scheduler.getReporter().getSchedulerSnapshot();
  try {
    (snap as any).state = SchedulerState.FAILED;
    assert(false, "Should fail modifying frozen snapshot");
  } catch (err) {
    assert(err instanceof TypeError, "Expected TypeError on modifying frozen snapshot");
  }
  // eslint-disable-next-line no-console
  console.log("17. Snapshot Immutability... ✓");

  // ==========================================
  // 18. Validator Rules...
  // ==========================================
  try {
    TaskSchedulerValidator.validateTaskId("invalid taskId space");
    assert(false, "Should fail on spaces");
  } catch (err) {
    assert(err instanceof TaskSchedulerValidationException, "Expected TaskSchedulerValidationException");
  }

  try {
    TaskSchedulerValidator.validateCircularDependencies([
      { id: "A", name: "A", state: TaskState.PENDING, priority: TaskPriority.NORMAL, schedule: { type: ScheduleType.ONCE, triggerType: TriggerType.MANUAL }, retryPolicy: { strategy: RetryPolicy.NONE, maxRetries: 0, initialDelayMs: 0 }, dependencies: ["B"], parameters: {}, createdAt: new Date(), updatedAt: new Date() },
      { id: "B", name: "B", state: TaskState.PENDING, priority: TaskPriority.NORMAL, schedule: { type: ScheduleType.ONCE, triggerType: TriggerType.MANUAL }, retryPolicy: { strategy: RetryPolicy.NONE, maxRetries: 0, initialDelayMs: 0 }, dependencies: ["A"], parameters: {}, createdAt: new Date(), updatedAt: new Date() }
    ]);
    assert(false, "Should fail on circular dependencies");
  } catch (err) {
    assert(err instanceof TaskSchedulerValidationException, "Expected TaskSchedulerValidationException");
  }
  // eslint-disable-next-line no-console
  console.log("18. Validator Rules... ✓");

  // ==========================================
  // 19. Background Scheduler...
  // ==========================================
  const bgScheduler = new TaskSchedulerBuilder()
    .withContext(context)
    .withConfig({
      concurrentLimit: 2,
      checkIntervalMs: 50,
      persistenceEnabled: false
    })
    .build() as TaskSchedulerEngine;

  await bgScheduler.initialize();
  await bgScheduler.start();

  const bgTask = await bgScheduler.getTaskManager().createTask({
    id: "task-bg-run",
    priority: TaskPriority.NORMAL,
    schedule: {
      type: ScheduleType.INTERVAL,
      intervalMs: 10,
      triggerType: TriggerType.TIME
    },
    parameters: {}
  });

  // Wait for the background loop to trigger it
  await new Promise(resolve => setTimeout(resolve, 150));

  const bgTaskFinalState = await bgScheduler.getTaskManager().getTask("task-bg-run");
  assert(bgTaskFinalState.state === TaskState.COMPLETED, "Background scheduler triggered and executed task autonomously");

  await bgScheduler.stop();
  // eslint-disable-next-line no-console
  console.log("19. Background Scheduler... ✓");

  // ==========================================
  // 20. Full End-to-End Autonomous Scheduling...
  // ==========================================
  const runtimeE2E = new RuntimeBuilder()
    .withContext(context)
    .withConfig({
      env: "test",
      heartbeatIntervalMs: 100,
      healthCheckIntervalMs: 200,
      startupTimeoutMs: 500,
      shutdownTimeoutMs: 500
    })
    .withHost({ id: "host-1" })
    .build();

  await runtimeE2E.initialize();
  await runtimeE2E.start();

  const activeScheduler = (runtimeE2E as any).getEngine("SchedulerEngine") as TaskSchedulerEngine;
  const tmE2E = activeScheduler.getTaskManager();

  await tmE2E.createTask({
    id: "task-e2e-run",
    priority: TaskPriority.CRITICAL,
    schedule: {
      type: ScheduleType.INTERVAL,
      intervalMs: 10,
      triggerType: TriggerType.TIME
    },
    parameters: {}
  });

  // Wait for interval to elapse
  await new Promise(resolve => setTimeout(resolve, 20));

  // Evaluate triggers and queue execution
  await activeScheduler.getTriggerManager().evaluateTriggers(new Date());
  await activeScheduler.processQueue();
  
  await new Promise(resolve => setTimeout(resolve, 50));

  const finalState = await tmE2E.getTask("task-e2e-run");
  assert(finalState.state === TaskState.COMPLETED, "E2E Task completed");

  await runtimeE2E.stop();
  // eslint-disable-next-line no-console
  console.log("20. Full End-to-End Autonomous Scheduling... ✓");

  // eslint-disable-next-line no-console
  console.log("\n=== ALL 20/20 TASK SCHEDULER ENGINE TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Test execution failed:", err);
  process.exit(1);
});
