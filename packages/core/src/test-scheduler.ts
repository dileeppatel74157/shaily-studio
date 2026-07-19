import { SchedulerBuilder } from "./scheduler/SchedulerBuilder";
import { SchedulerEngine } from "./scheduler/SchedulerEngine";
import { SchedulerState } from "./scheduler/SchedulerState";
import { TaskState } from "./scheduler/TaskState";
import { ScheduleType } from "./scheduler/ScheduleType";
import { TriggerType } from "./scheduler/TriggerType";
import { RetryStrategy } from "./scheduler/RetryStrategy";
import { QueuePriority } from "./scheduler/QueuePriority";
import { DependencyState } from "./scheduler/DependencyState";
import { SchedulerEventType } from "./scheduler/SchedulerEventType";
import { SchedulerValidator } from "./scheduler/SchedulerValidator";
import {
  SchedulerValidationException,
  InvalidSchedulerStateException,
  CronParseException
} from "./scheduler/types";
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
  console.log("=== START SPRINT 19.2 SCHEDULER ENGINE TESTS ===\n");

  const memoryStore = new MockMemoryStore();
  const context = {
    env: "test",
    namespace: "scheduler-test-namespace",
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
    new SchedulerBuilder().build();
    assert(false, "Should fail without context");
  } catch (err) {
    assert(err instanceof SchedulerValidationException, "Expected SchedulerValidationException");
  }

  const scheduler = new SchedulerBuilder()
    .withContext(context)
    .withConfig(config)
    .build() as SchedulerEngine;

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
    assert(err instanceof InvalidSchedulerStateException, "Expected InvalidSchedulerStateException");
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
    priority: QueuePriority.HIGH,
    schedule: {
      type: ScheduleType.ONCE,
      triggerType: TriggerType.MANUAL
    },
    retryPolicy: {
      strategy: RetryStrategy.FIXED_DELAY,
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
  // 4. Queue Management...
  // ==========================================
  const qm = scheduler.getQueueManager();
  await qm.enqueue(task);
  
  const qItems = qm.getQueueItems();
  assert(qItems.length === 1, "Queue should contain 1 item");
  assert(qItems[0].taskId === "task-1", "Correct task enqueued");
  
  const dequeued = await qm.dequeue();
  assert(dequeued?.taskId === "task-1", "Dequeued matching task");
  // eslint-disable-next-line no-console
  console.log("4. Queue Management... ✓");

  // ==========================================
  // 5. Priority Scheduling...
  // ==========================================
  const taskLow = await tm.createTask({
    id: "task-low",
    priority: QueuePriority.LOW,
    schedule: { type: ScheduleType.ONCE, triggerType: TriggerType.MANUAL },
    parameters: {}
  });

  const taskCritical = await tm.createTask({
    id: "task-critical",
    priority: QueuePriority.CRITICAL,
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
  console.log("5. Priority Scheduling... ✓");

  // ==========================================
  // 6. Daily Schedule...
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
  await qm.dequeue(); // clean
  // eslint-disable-next-line no-console
  console.log("6. Daily Schedule... ✓");

  // ==========================================
  // 7. Weekly Schedule...
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
  await qm.dequeue();
  // eslint-disable-next-line no-console
  console.log("7. Weekly Schedule... ✓");

  // ==========================================
  // 8. Interval Schedule...
  // ==========================================
  const intervalTask = await tm.createTask({
    id: "task-interval",
    schedule: {
      type: ScheduleType.INTERVAL,
      intervalMs: 100,
      triggerType: TriggerType.TIME
    },
    parameters: {}
  });
  
  await new Promise(resolve => setTimeout(resolve, 150));
  await trm.evaluateTriggers(new Date());
  assert(intervalTask.state === TaskState.QUEUED, "Interval task triggered");
  await qm.dequeue();
  // eslint-disable-next-line no-console
  console.log("8. Interval Schedule... ✓");

  // ==========================================
  // 9. Cron Schedule...
  // ==========================================
  const cronManager = scheduler.getCronManager();
  const cron = cronManager.parseCron("*/5 * * * *");
  
  assert(cron.minutes.includes(5) && cron.minutes.includes(10), "Parsed step minutes");
  assert(cron.hours.length === 24, "Asterisk hours mapped to all hours");

  const matchTime = new Date();
  matchTime.setMinutes(15);
  assert(cronManager.isCronDue(cron, matchTime), "Cron evaluates due on match minute");
  // eslint-disable-next-line no-console
  console.log("9. Cron Schedule... ✓");

  // ==========================================
  // 10. Dependency Resolution...
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
  console.log("10. Dependency Resolution... ✓");

  // ==========================================
  // 11. Retry Logic...
  // ==========================================
  const failTask = await tm.createTask({
    id: "task-fail",
    schedule: { type: ScheduleType.ONCE, triggerType: TriggerType.MANUAL },
    retryPolicy: {
      strategy: RetryStrategy.FIXED_DELAY,
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
  console.log("11. Retry Logic... ✓");

  // ==========================================
  // 12. Auto Resume...
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
  const secondaryScheduler = new SchedulerBuilder()
    .withContext(context)
    .withConfig(config)
    .build();
  await secondaryScheduler.initialize();

  const restoredTask = await secondaryScheduler.getTaskManager().getTask("task-pending-persistence");
  assert(restoredTask.state === TaskState.QUEUED, "State restored successfully");
  // eslint-disable-next-line no-console
  console.log("12. Auto Resume... ✓");

  // ==========================================
  // 13. Runtime Integration...
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
  console.log("13. Runtime Integration... ✓");

  // ==========================================
  // 14. Pipeline Integration...
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
  console.log("14. Pipeline Integration... ✓");

  // ==========================================
  // 15. Assistant Integration...
  // ==========================================
  const assistTask = await tm.createTask({
    id: "task-assist",
    schedule: { type: ScheduleType.ONCE, triggerType: TriggerType.MANUAL },
    parameters: {}
  });

  await tm.pauseTask(assistTask.id);
  assert(assistTask.state === TaskState.WAITING, "Task state set to WAITING on pause");
  
  await tm.resumeTask(assistTask.id);
  assert(assistTask.state === TaskState.PENDING, "Task state returned to PENDING on resume");
  
  await tm.cancelTask(assistTask.id);
  assert(assistTask.state === TaskState.CANCELLED, "Task state set to CANCELLED on cancel");
  // eslint-disable-next-line no-console
  console.log("15. Assistant Integration... ✓");

  // ==========================================
  // 16. Memory Integration...
  // ==========================================
  await scheduler.logToMemory("executions", "exec-test-1", { status: "running" });
  assert(await memoryStore.has("executions", "exec-test-1"), "Executions namespace integration works");
  // eslint-disable-next-line no-console
  console.log("16. Memory Integration... ✓");

  // ==========================================
  // 17. Event Publishing...
  // ==========================================
  let eventFired = false;
  scheduler.on("TaskScheduled", () => { eventFired = true; });
  await tm.createTask({ id: "task-event-check", parameters: {} });
  assert(eventFired, "TaskScheduled event published successfully");
  // eslint-disable-next-line no-console
  console.log("17. Event Publishing... ✓");

  // ==========================================
  // 18. Snapshot Immutability...
  // ==========================================
  const snap = scheduler.getReporter().getSchedulerSnapshot();
  try {
    (snap as any).state = SchedulerState.FAILED;
    assert(false, "Should fail modifying frozen snapshot");
  } catch (err) {
    assert(err instanceof TypeError, "Expected TypeError on modifying frozen snapshot");
  }
  // eslint-disable-next-line no-console
  console.log("18. Snapshot Immutability... ✓");

  // ==========================================
  // 19. Validator Rules...
  // ==========================================
  try {
    SchedulerValidator.validateTaskId("invalid taskId space");
    assert(false, "Should fail on spaces");
  } catch (err) {
    assert(err instanceof SchedulerValidationException, "Expected SchedulerValidationException");
  }

  try {
    SchedulerValidator.validateCircularDependencies([
      { id: "A", name: "A", state: TaskState.PENDING, priority: QueuePriority.NORMAL, schedule: { type: ScheduleType.ONCE, triggerType: TriggerType.MANUAL }, retryPolicy: { strategy: RetryStrategy.NONE, maxRetries: 0, initialDelayMs: 0 }, dependencies: ["B"], parameters: {}, createdAt: new Date(), updatedAt: new Date() },
      { id: "B", name: "B", state: TaskState.PENDING, priority: QueuePriority.NORMAL, schedule: { type: ScheduleType.ONCE, triggerType: TriggerType.MANUAL }, retryPolicy: { strategy: RetryStrategy.NONE, maxRetries: 0, initialDelayMs: 0 }, dependencies: ["A"], parameters: {}, createdAt: new Date(), updatedAt: new Date() }
    ]);
    assert(false, "Should fail on circular dependencies");
  } catch (err) {
    assert(err instanceof SchedulerValidationException, "Expected SchedulerValidationException");
  }
  // eslint-disable-next-line no-console
  console.log("19. Validator Rules... ✓");

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

  const activeScheduler = (runtimeE2E as any).getEngine("SchedulerEngine") as SchedulerEngine;
  const tmE2E = activeScheduler.getTaskManager();
  const qmE2E = activeScheduler.getQueueManager();

  const runTask = await tmE2E.createTask({
    id: "task-e2e-run",
    priority: QueuePriority.CRITICAL,
    schedule: {
      type: ScheduleType.INTERVAL,
      intervalMs: 10,
      triggerType: TriggerType.TIME
    },
    parameters: {}
  });

  // Wait for interval to elapse
  await new Promise(resolve => setTimeout(resolve, 20));

  // Evaluate and trigger execution
  await activeScheduler.getTriggerManager().evaluateTriggers(new Date());
  await (activeScheduler as any).processQueue();
  
  // Wait a short delay to allow background queue execution to proceed
  await new Promise(resolve => setTimeout(resolve, 50));

  const finalState = await tmE2E.getTask("task-e2e-run");
  assert(finalState.state === TaskState.COMPLETED, "E2E Task ran and completed autonomously");

  await runtimeE2E.stop();
  // eslint-disable-next-line no-console
  console.log("20. Full End-to-End Autonomous Scheduling... ✓");

  // eslint-disable-next-line no-console
  console.log("\n=== ALL 20/20 SCHEDULER ENGINE TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Test execution failed:", err);
  process.exit(1);
});
