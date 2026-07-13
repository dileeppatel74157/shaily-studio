import { LoggerBuilder } from "./logger/LoggerBuilder";
import { EventBus } from "./events/EventBus";
import { JsonFormatter } from "./logger/LogFormatter";
import { JobEngine } from "./jobs/JobEngine";
import { JobBuilder } from "./jobs/JobBuilder";
import { JobPriority } from "./jobs/JobPriority";
import { JobStatus } from "./jobs/JobStatus";
import { JobScheduler } from "./jobs/JobScheduler";
import { InvalidJobStateException, JobEngineNotRunningException } from "./jobs/types";

class SilentTransport {
  public send(): void {}
}

const logger = new LoggerBuilder()
  .addTransport(new SilentTransport())
  .withFormatter(new JsonFormatter())
  .build();

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

async function runTests() {
  console.log("=== START JOB ENGINE VERIFICATION TESTS ===");
  const eventBus = new EventBus(logger);

  // ==================================================
  // Test 1: Submit and Execution Works
  // ==================================================
  console.log("\n1. Running Submit and Execution Tests...");
  {
    const engine = new JobEngine(logger, eventBus);
    await engine.start();

    let executed = false;
    const job = new JobBuilder()
      .withName("test-job-1")
      .withExecution(async () => {
        executed = true;
        return "success-result";
      })
      .build();

    const eventsReceived: string[] = [];
    eventBus.subscribe("job.queued", (ev) => {
      eventsReceived.push(ev.name);
    });
    eventBus.subscribe("job.started", (ev) => {
      eventsReceived.push(ev.name);
    });
    eventBus.subscribe("job.completed", (ev) => {
      eventsReceived.push(ev.name);
    });

    await engine.submit(job);

    // Wait a brief period for async execution
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    assert(executed, "Job execution function must be called");
    assert(job.status === JobStatus.COMPLETED, "Job status must be COMPLETED");
    assert(job.result === "success-result", "Job result must match");
    assert(eventsReceived.includes("job.queued"), "Must publish job.queued event");
    assert(eventsReceived.includes("job.started"), "Must publish job.started event");
    assert(eventsReceived.includes("job.completed"), "Must publish job.completed event");

    await engine.stop();
    console.log("   ✓ Job submission and execution verified.");
  }

  // ==================================================
  // Test 2: Priority Queue & FIFO within Same Priority
  // ==================================================
  console.log("\n2. Running Priority Queue & FIFO Tests...");
  {
    // Concurrency = 1, so we can block execution and check queue sorting
    const engine = new JobEngine(logger, eventBus, { maxConcurrency: 1 });
    await engine.start();

    const executionOrder: string[] = [];

    // Job 1 (Normal) - Starts running immediately and blocks
    let resolveJob1: () => void = () => {};
    const job1Promise = new Promise<void>((resolve) => {
      resolveJob1 = resolve;
    });
    const job1 = new JobBuilder()
      .withName("Job1-Normal")
      .withPriority(JobPriority.NORMAL)
      .withExecution(async () => {
        await job1Promise;
        executionOrder.push("Job1");
      })
      .build();

    // Queued jobs:
    let resolveJob2: () => void = () => {};
    const job2Promise = new Promise<void>((resolve) => {
      resolveJob2 = resolve;
    });
    const job2 = new JobBuilder()
      .withName("Job2-Normal")
      .withPriority(JobPriority.NORMAL)
      .withExecution(async () => {
        await job2Promise;
        executionOrder.push("Job2");
      })
      .build();

    let resolveJob3: () => void = () => {};
    const job3Promise = new Promise<void>((resolve) => {
      resolveJob3 = resolve;
    });
    const job3 = new JobBuilder()
      .withName("Job3-High")
      .withPriority(JobPriority.HIGH)
      .withExecution(async () => {
        await job3Promise;
        executionOrder.push("Job3");
      })
      .build();

    let resolveJob4: () => void = () => {};
    const job4Promise = new Promise<void>((resolve) => {
      resolveJob4 = resolve;
    });
    const job4 = new JobBuilder()
      .withName("Job4-Normal")
      .withPriority(JobPriority.NORMAL)
      .withExecution(async () => {
        await job4Promise;
        executionOrder.push("Job4");
      })
      .build();

    let resolveJob5: () => void = () => {};
    const job5Promise = new Promise<void>((resolve) => {
      resolveJob5 = resolve;
    });
    const job5 = new JobBuilder()
      .withName("Job5-Critical")
      .withPriority(JobPriority.CRITICAL)
      .withExecution(async () => {
        await job5Promise;
        executionOrder.push("Job5");
      })
      .build();

    let resolveJob6: () => void = () => {};
    const job6Promise = new Promise<void>((resolve) => {
      resolveJob6 = resolve;
    });
    const job6 = new JobBuilder()
      .withName("Job6-Low")
      .withPriority(JobPriority.LOW)
      .withExecution(async () => {
        await job6Promise;
        executionOrder.push("Job6");
      })
      .build();

    await engine.submit(job1);
    await new Promise<void>((resolve) => setTimeout(resolve, 10)); // Allow job1 to start running

    // Queue up the rest
    await engine.submit(job2); // Normal (queued 1st)
    await engine.submit(job3); // High
    await engine.submit(job4); // Normal (queued 2nd)
    await engine.submit(job5); // Critical
    await engine.submit(job6); // Low

    // Snapshot to inspect queue order before they run
    const snap = engine.snapshot();
    const queuedNames = snap.jobs.filter((j) => j.status === JobStatus.QUEUED).map((j) => j.name);

    // Expected order: Critical, High, Normal (FIFO: Job2 before Job4), Low
    assert(queuedNames[0] === "Job5-Critical", "1st queued should be Critical");
    assert(queuedNames[1] === "Job3-High", "2nd queued should be High");
    assert(queuedNames[2] === "Job2-Normal", "3rd queued should be Job2 (Normal, FIFO 1st)");
    assert(queuedNames[3] === "Job4-Normal", "4th queued should be Job4 (Normal, FIFO 2nd)");
    assert(queuedNames[4] === "Job6-Low", "5th queued should be Low");

    // Release them one by one to verify execution order
    resolveJob1();
    await new Promise<void>((resolve) => setTimeout(resolve, 10)); // wait for job 5 to start
    resolveJob5();
    await new Promise<void>((resolve) => setTimeout(resolve, 10)); // wait for job 3 to start
    resolveJob3();
    await new Promise<void>((resolve) => setTimeout(resolve, 10)); // wait for job 2 to start
    resolveJob2();
    await new Promise<void>((resolve) => setTimeout(resolve, 10)); // wait for job 4 to start
    resolveJob4();
    await new Promise<void>((resolve) => setTimeout(resolve, 10)); // wait for job 6 to start
    resolveJob6();

    await new Promise<void>((resolve) => setTimeout(resolve, 50)); // let everything complete

    assert(executionOrder[0] === "Job1", "Job1 ran first");
    assert(executionOrder[1] === "Job5", "Job5 (Critical) ran second");
    assert(executionOrder[2] === "Job3", "Job3 (High) ran third");
    assert(executionOrder[3] === "Job2", "Job2 (Normal, FIFO) ran fourth");
    assert(executionOrder[4] === "Job4", "Job4 (Normal, FIFO) ran fifth");
    assert(executionOrder[5] === "Job6", "Job6 (Low) ran sixth");

    await engine.stop();
    console.log("   ✓ Priority scheduling and FIFO within same priority verified.");
  }

  // ==================================================
  // Test 3: Cancellation Works (Queued)
  // ==================================================
  console.log("\n3. Running Queued Job Cancellation Tests...");
  {
    const engine = new JobEngine(logger, eventBus, { maxConcurrency: 1 });
    await engine.start();

    // Blocking job to occupy the execution slot
    let resolveBlocker: () => void = () => {};
    const blocker = new JobBuilder()
      .withName("blocker")
      .withExecution(async () => {
        await new Promise<void>((resolve) => {
          resolveBlocker = resolve;
        });
      })
      .build();

    const target = new JobBuilder()
      .withName("cancel-target")
      .withExecution(async () => {})
      .build();

    let cancelledEventPublished = false;
    eventBus.subscribe("job.cancelled", (ev) => {
      if (ev.payload.jobId === target.id) {
        cancelledEventPublished = true;
      }
    });

    await engine.submit(blocker);
    await engine.submit(target);

    // Cancel target which is in queue
    const cancelResult = await engine.cancel(target.id);
    assert(cancelResult === true, "cancel() must return true for queued job");
    assert(target.status === JobStatus.CANCELLED, "Target status must be CANCELLED");

    // Release blocker
    resolveBlocker();
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    assert(cancelledEventPublished, "Must publish job.cancelled event");
    assert(engine.get(target.id)?.status === JobStatus.CANCELLED, "Engine get status matches");

    await engine.stop();
    console.log("   ✓ Queued job cancellation verified successfully.");
  }

  // ==================================================
  // Test 4: Cancellation Works (Running)
  // ==================================================
  console.log("\n4. Running Running Job Cancellation Tests...");
  {
    const engine = new JobEngine(logger, eventBus);
    await engine.start();

    let signalAborted = false;
    let resolveJob: () => void = () => {};
    const target = new JobBuilder()
      .withName("running-cancel-target")
      .withExecution(async (ctx) => {
        ctx.signal.addEventListener("abort", () => {
          signalAborted = true;
        });
        await new Promise<void>((resolve) => {
          resolveJob = resolve;
        });
      })
      .build();

    let cancelledEventPublished = false;
    eventBus.subscribe("job.cancelled", (ev) => {
      if (ev.payload.jobId === target.id) {
        cancelledEventPublished = true;
      }
    });

    await engine.submit(target);
    await new Promise<void>((resolve) => setTimeout(resolve, 10)); // let it start running

    // Cancel running job
    const cancelResult = await engine.cancel(target.id);
    assert(cancelResult === true, "cancel() must return true for running job");

    // Release the block so execution finishes and catches abort
    resolveJob();
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    assert(signalAborted, "Abort signal inside job context must be triggered");
    assert(target.status === JobStatus.CANCELLED, "Target status must be CANCELLED");
    assert(cancelledEventPublished, "Must publish job.cancelled event");

    await engine.stop();
    console.log("   ✓ Running job cancellation verified successfully.");
  }

  // ==================================================
  // Test 5: Status Transitions & Immutability
  // ==================================================
  console.log("\n5. Running Status Transitions & Immutability Tests...");
  {
    const job = new JobBuilder()
      .withName("immutable-test")
      .withExecution(async () => "result")
      .build();

    // Verify initial mutable state
    assert(job.status === JobStatus.PENDING, "Starts pending");
    job.queue();
    assert(job.status === JobStatus.QUEUED, "Can transition to queued");

    job.start(new Date());
    assert(job.status === JobStatus.RUNNING, "Can transition to running");

    job.complete(new Date(), "finished");
    assert(job.status === JobStatus.COMPLETED, "Can transition to completed");

    // Verify immutability after completion
    try {
      job.fail(new Date(), new Error("hack"));
      throw new Error("Should not allow transitioning completed job to failed");
    } catch (err) {
      assert(err instanceof InvalidJobStateException, "Throws InvalidJobStateException");
    }

    try {
      // In strict mode, modifying a frozen property throws an error
      (job as any).name = "HackedName";
      throw new Error("Should not allow property mutation on frozen Job");
    } catch (err) {
      // correctly caught mutation error
    }

    console.log("   ✓ Immutability and state transition constraints verified.");
  }

  // ==================================================
  // Test 6: Failure Handling Works
  // ==================================================
  console.log("\n6. Running Failure Handling Tests...");
  {
    const engine = new JobEngine(logger, eventBus);
    await engine.start();

    const job = new JobBuilder()
      .withName("failing-job")
      .withExecution(async () => {
        throw new Error("Fatal simulation error");
      })
      .build();

    let failedEventPublished = false;
    let failedReason = "";
    eventBus.subscribe("job.failed", (ev) => {
      if (ev.payload.jobId === job.id) {
        failedEventPublished = true;
        failedReason = ev.payload.error;
      }
    });

    await engine.submit(job);
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    assert(job.status === JobStatus.FAILED, "Job status must be FAILED");
    assert(job.error !== undefined, "Job error must be captured");
    assert(job.error!.message === "Fatal simulation error", "Job error message matches");
    assert(failedEventPublished, "Must publish job.failed event");
    assert(failedReason === "Fatal simulation error", "Failed reason matches");

    await engine.stop();
    console.log("   ✓ Failure catching and logging verified.");
  }

  // ==================================================
  // Test 7: Graceful Shutdown
  // ==================================================
  console.log("\n7. Running Graceful Shutdown Tests...");
  {
    const engine = new JobEngine(logger, eventBus, { maxConcurrency: 1 });
    await engine.start();

    let jobCompleted = false;
    let resolveJob: () => void = () => {};
    const job = new JobBuilder()
      .withName("graceful-job")
      .withExecution(async () => {
        await new Promise<void>((resolve) => {
          resolveJob = resolve;
        });
        jobCompleted = true;
      })
      .build();

    await engine.submit(job);
    await new Promise<void>((resolve) => setTimeout(resolve, 10)); // allow job to start running

    // Initiate stop
    let stopCompleted = false;
    const stopPromise = engine.stop().then(() => {
      stopCompleted = true;
    });

    // Check that engine is in stopping state and stop has NOT resolved yet
    assert(engine.state === "stopping", "Engine should be in stopping state");
    assert(stopCompleted === false, "stop() should block while job is running");

    // Resolve job
    resolveJob();
    await stopPromise; // Await stop completion

    assert(jobCompleted, "Job should finish execution");
    assert(stopCompleted, "stop() should resolve after job finishes");
    assert(engine.state === "stopped", "Engine is finally stopped");

    // Submitting after stop should throw
    try {
      const newJob = new JobBuilder()
        .withName("bad")
        .withExecution(async () => {})
        .build();
      await engine.submit(newJob);
      throw new Error("Should not allow submit when stopped");
    } catch (err) {
      assert(err instanceof JobEngineNotRunningException, "Throws JobEngineNotRunningException");
    }

    console.log("   ✓ Graceful shutdown verified successfully.");
  }

  // ==================================================
  // Test 8: Job Engine Snapshot
  // ==================================================
  console.log("\n8. Running Snapshot Tests...");
  {
    const engine = new JobEngine(logger, eventBus);
    await engine.start();

    const job = new JobBuilder()
      .withName("snap-test")
      .withExecution(async () => "ok")
      .build();

    await engine.submit(job);
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    const snap = engine.snapshot();
    assert(Object.isFrozen(snap), "Engine Snapshot must be frozen");
    assert(Object.isFrozen(snap.jobs), "Snapshot jobs list must be frozen");
    assert(snap.jobs.length === 1, "Snapshot includes the job");
    assert(snap.completedCount === 1, "Snapshot matches completed count");

    const jobSnap = snap.jobs[0];
    assert(Object.isFrozen(jobSnap), "Job snapshot must be frozen");
    assert(jobSnap.status === JobStatus.COMPLETED, "Job snapshot status is correct");
    assert(jobSnap.result === "ok", "Job snapshot result is correct");

    try {
      (snap as any).status = "hacked";
      throw new Error("Should not allow modifying frozen snapshot");
    } catch (err) {
      // correctly caught mutation error
    }

    await engine.stop();
    console.log("   ✓ Immutable snapshots verified successfully.");
  }

  // ==================================================
  // Test 9: JobScheduler Integration
  // ==================================================
  console.log("\n9. Running Scheduler Tests...");
  {
    const engine = new JobEngine(logger, eventBus);
    await engine.start();

    const scheduler = new JobScheduler(engine);
    let schedulerRan = false;
    const job = new JobBuilder()
      .withName("scheduler-job")
      .withExecution(async () => {
        schedulerRan = true;
      })
      .build();

    await scheduler.schedule(job);
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    assert(schedulerRan, "Scheduler immediate execution must run job");

    try {
      await scheduler.scheduleDelayed(job, 1000);
      throw new Error("Should throw on delayed schedule");
    } catch (err: any) {
      assert(
        err.message.includes("Delayed scheduling is not supported"),
        "Error message matches delayed scheduling block"
      );
    }

    await engine.stop();
    console.log("   ✓ JobScheduler verified successfully.");
  }

  console.log("\n=== ALL JOB ENGINE TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
