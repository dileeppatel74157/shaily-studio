import { SchedulerBuilder } from "./scheduler/SchedulerBuilder";
import { SchedulerContext } from "./scheduler/SchedulerContext";
import { ScheduleBuilder } from "./scheduler/ScheduleBuilder";
import { ScheduledJob } from "./scheduler/ScheduledJob";
import { SchedulerQueue } from "./scheduler/SchedulerQueue";
import { SchedulerState } from "./scheduler/SchedulerState";
import { SchedulerValidator } from "./scheduler/SchedulerValidator";
import { ScheduleType } from "./scheduler/ScheduleType";
import { Schedule } from "./scheduler/Schedule";
import {
  SchedulerException,
  SchedulerValidationException,
  InvalidSchedulerStateException,
} from "./scheduler/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    // eslint-disable-next-line no-console
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

async function runTests() {
  // eslint-disable-next-line no-console
  console.log("=== START SCHEDULER FRAMEWORK VERIFICATION TESTS ===");

  const context: SchedulerContext = {
    env: "production",
    namespace: "studio-jobs",
    metadata: { version: "1.0.0" },
  };

  // ==========================================
  // 1. Builder Validation
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("1. Running Builder Validation...");

  // Valid construction
  const scheduler = new SchedulerBuilder()
    .withContext(context)
    .withMetadata({ module: "video-renderer" })
    .build();

  assert(scheduler !== null, "Scheduler instance must be successfully constructed");

  // Invalid construction (missing context)
  try {
    new SchedulerBuilder().build();
    throw new Error("Should have rejected build with missing context");
  } catch (err: unknown) {
    assert(
      err instanceof SchedulerValidationException,
      "Expected SchedulerValidationException for missing context"
    );
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified Builder Validation.");

  // ==========================================
  // 2. Lifecycle State Transitions
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("2. Running Lifecycle Transition Validation...");

  const testSched = new SchedulerBuilder().withContext(context).build();

  // Try calling runtime operation in CREATED state
  try {
    await testSched.trigger("job-1");
    throw new Error("Should have prevented trigger in CREATED state");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidSchedulerStateException,
      "Expected InvalidSchedulerStateException for CREATED state"
    );
  }

  // CREATED -> READY
  await testSched.initialize();

  // Try illegal transition READY -> STOPPED
  try {
    await testSched.stop();
    throw new Error("Should have prevented READY -> STOPPED");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidSchedulerStateException,
      "Expected InvalidSchedulerStateException for READY -> STOPPED"
    );
  }

  // READY -> RUNNING
  await testSched.start();

  // Try illegal transition RUNNING -> READY
  try {
    await testSched.initialize();
    throw new Error("Should have prevented RUNNING -> READY");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidSchedulerStateException,
      "Expected InvalidSchedulerStateException for RUNNING -> READY"
    );
  }

  // RUNNING -> STOPPED
  await testSched.stop();

  // Once stopped, operations must fail
  try {
    await testSched.trigger("job-1");
    throw new Error("Should have prevented trigger in STOPPED state");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidSchedulerStateException,
      "Expected InvalidSchedulerStateException for STOPPED state"
    );
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified Lifecycle State Transition and exception rules.");

  // ==========================================
  // 3. Schedule Registration & Duplicates
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("3. Running Schedule Registration & Duplicates checks...");

  const activeSched = new SchedulerBuilder().withContext(context).build();
  await activeSched.initialize();
  await activeSched.start();

  const schedule1 = new ScheduleBuilder()
    .withId("video.render")
    .withName("Render Video Job")
    .withType(ScheduleType.ONE_TIME)
    .withHandlerName("renderer")
    .withPriority(10)
    .build();

  await activeSched.schedule(schedule1, async () => {});

  assert(activeSched.has("video.render"), "Should have registered schedule");
  assert(activeSched.get("video.render")?.name === "Render Video Job", "Query details match");

  // Duplicate registration check
  try {
    await activeSched.schedule(schedule1, async () => {});
    throw new Error("Should have rejected duplicate schedule registration");
  } catch (err: unknown) {
    assert(
      err instanceof SchedulerValidationException,
      "Expected SchedulerValidationException for duplicate ID"
    );
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified schedule registration constraints.");

  // ==========================================
  // 4. Execution Delegation & Manual Trigger
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("4. Running Manual Trigger & Execution Delegation...");

  const executionRecord = { handlerExecuted: false };
  let executedJob: ScheduledJob | null = null;

  const schedule2 = new ScheduleBuilder()
    .withId("video.compress")
    .withName("Compress Video Job")
    .withType(ScheduleType.ONE_TIME)
    .withHandlerName("compressor")
    .withPriority(5)
    .build();

  await activeSched.schedule(schedule2, async (job) => {
    executionRecord.handlerExecuted = true;
    executedJob = job;
  });

  await activeSched.trigger("video.compress");

  assert(executionRecord.handlerExecuted === true, "Handler should have been executed");
  assert(executedJob !== null, "Job reference should be captured");
  assert(executedJob!.scheduleId === "video.compress", "Triggered correct schedule ID");

  const snap = activeSched.snapshot();
  const history = snap.history;
  assert(history.length > 0, "Execution history recorded");
  
  const compJob = history.find((h) => h.scheduleId === "video.compress");
  assert(compJob !== undefined, "Completed job entry exists in history");
  assert(compJob!.status === "COMPLETED", "Job finished successfully");
  assert(compJob!.duration !== undefined && compJob!.duration >= 0, "Duration calculated");

  // eslint-disable-next-line no-console
  console.log("   ✓ Verified successful manual triggers and handler delegation.");

  // ==========================================
  // 5. Queue Priority Ordering
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("5. Running Queue Priority Ordering Validation...");

  const queue = new SchedulerQueue();
  queue.push({ id: "j1", scheduleId: "s1", status: "PENDING", attempt: 1 }, 10);
  queue.push({ id: "j2", scheduleId: "s2", status: "PENDING", attempt: 1 }, 100);
  queue.push({ id: "j3", scheduleId: "s3", status: "PENDING", attempt: 1 }, 50);

  const pop1 = queue.pop();
  assert(pop1 !== undefined && pop1.id === "j2", "Highest priority job popped first (priority 100)");

  const pop2 = queue.pop();
  assert(pop2 !== undefined && pop2.id === "j3", "Second priority job popped next (priority 50)");

  const pop3 = queue.pop();
  assert(pop3 !== undefined && pop3.id === "j1", "Lowest priority job popped last (priority 10)");
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified queue priority sort order.");

  // ==========================================
  // 6. Pause / Resume
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("6. Running Pause & Resume Validation...");

  await activeSched.pause("video.render");

  try {
    await activeSched.trigger("video.render");
    throw new Error("Should have prevented triggering paused schedule");
  } catch (err: unknown) {
    assert(
      err instanceof SchedulerValidationException,
      "Expected SchedulerValidationException for triggering paused schedule"
    );
  }

  // Resume
  await activeSched.resume("video.render");
  await activeSched.trigger("video.render"); // Should pass now

  const renderHistory = activeSched.snapshot().history.filter((h) => h.scheduleId === "video.render");
  assert(renderHistory.length === 1, "Schedule executed successfully after resume");
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified schedule pauses and resumes.");

  // ==========================================
  // 7. Failure Handling & Retries
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("7. Running Failure Handling & Retry Validation...");

  let attempts = 0;
  const failingSchedule = new ScheduleBuilder()
    .withId("video.fail")
    .withName("Failing Job")
    .withType(ScheduleType.ONE_TIME)
    .withHandlerName("failer")
    .withPolicy({ maxRetries: 2, backoffMs: 0, concurrencyLimit: 1 })
    .build();

  await activeSched.schedule(failingSchedule, async () => {
    attempts++;
    throw new Error("Connection failed");
  });

  await activeSched.trigger("video.fail");

  const failHistory = activeSched.snapshot().history.find((h) => h.scheduleId === "video.fail");
  assert(failHistory !== undefined, "Failing job recorded in history");
  assert(failHistory!.status === "FAILED", "Job finished in FAILED state");
  assert(attempts === 3, "Executed exactly 3 times (1 initial + 2 retries)");
  assert(failHistory!.attempt === 3, "Attempt count matches 3");
  assert(failHistory!.error === "Connection failed", "Error message recorded correctly");

  // eslint-disable-next-line no-console
  console.log("   ✓ Verified retry limits and error logs.");

  // ==========================================
  // 8. Snapshot Immutability
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("8. Running Snapshot Immutability Validation...");

  const snapshot = activeSched.snapshot();

  // Root snapshot
  try {
    (snapshot as any).timestamp = new Date(0);
    throw new Error("Should have thrown error on modifying snapshot root");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Expected TypeError on modifying frozen snapshot");
  }

  // History array
  try {
    (snapshot.history as any)[0] = null;
    throw new Error("Should have thrown error on modifying history array");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Expected TypeError on modifying frozen history");
  }

  // Schedule objects
  try {
    (snapshot.schedules[0] as any).name = "hacked";
    throw new Error("Should have thrown error on modifying schedule");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Expected TypeError on modifying frozen schedule");
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified deep freeze immutability on snapshots and schedules.");

  // ==========================================
  // 9. Validator Rules
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("9. Running Validator Rule Checks...");

  // Invalid key identifiers
  try {
    SchedulerValidator.validateIdentifier("invalid id space", "Test ID");
    throw new Error("Should have rejected space in ID");
  } catch (err: unknown) {
    assert(
      err instanceof SchedulerValidationException,
      "Expected SchedulerValidationException for space in ID"
    );
  }

  try {
    SchedulerValidator.validateIdentifier("invalid_@_char", "Test ID");
    throw new Error("Should have rejected special symbol in ID");
  } catch (err: unknown) {
    assert(
      err instanceof SchedulerValidationException,
      "Expected SchedulerValidationException for special symbol in ID"
    );
  }

  // Invalid trigger (negative interval)
  try {
    SchedulerValidator.validateTrigger({ intervalMs: -100 });
    throw new Error("Should have rejected negative intervalMs");
  } catch (err: unknown) {
    assert(
      err instanceof SchedulerValidationException,
      "Expected SchedulerValidationException for negative intervalMs"
    );
  }

  // Invalid policy (negative retries)
  try {
    SchedulerValidator.validatePolicy({ maxRetries: -1, backoffMs: 10, concurrencyLimit: 1 });
    throw new Error("Should have rejected negative maxRetries");
  } catch (err: unknown) {
    assert(
      err instanceof SchedulerValidationException,
      "Expected SchedulerValidationException for negative maxRetries"
    );
  }

  // Invalid policy (concurrencyLimit <= 0)
  try {
    SchedulerValidator.validatePolicy({ maxRetries: 3, backoffMs: 10, concurrencyLimit: 0 });
    throw new Error("Should have rejected zero concurrencyLimit");
  } catch (err: unknown) {
    assert(
      err instanceof SchedulerValidationException,
      "Expected SchedulerValidationException for zero concurrencyLimit"
    );
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified validator rule constraints.");

  // eslint-disable-next-line no-console
  console.log("=== ALL SCHEDULER FRAMEWORK VERIFICATION TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Test execution failed:", err);
  process.exit(1);
});
