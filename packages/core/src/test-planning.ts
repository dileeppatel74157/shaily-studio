import { LoggerBuilder } from "./logger/LoggerBuilder";
import { EventBus } from "./events/EventBus";
import { ConfigBuilder } from "./config/ConfigBuilder";
import { RegistryBuilder } from "./registry/RegistryBuilder";
import { JsonFormatter } from "./logger/LogFormatter";

import { PlanningBuilder } from "./planning/PlanningBuilder";
import { PlanningEngine } from "./planning/PlanningEngine";
import { PlanningContext } from "./planning/PlanningContext";
import { PlanningConfiguration } from "./planning/PlanningConfiguration";
import { PlanningStrategy } from "./planning/PlanningStrategy";
import { PlanStatus } from "./planning/PlanStatus";
import { GoalPriority } from "./planning/GoalPriority";
import { GoalStatus } from "./planning/GoalStatus";
import { GoalType } from "./planning/GoalType";
import { PlanningValidator } from "./planning/PlanningValidator";
import { PlanningValidationException } from "./planning/types";

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
  console.log("=== START PLANNING ENGINE TESTS ===");

  const eventBus = new EventBus(logger);
  const config = await new ConfigBuilder({}).build();
  const serviceRegistry = new RegistryBuilder().build();

  const context: PlanningContext = {
    logger,
    config,
    registry: serviceRegistry,
    eventBus,
  };

  const configuration: PlanningConfiguration = {
    maxPlanningRetries: 2,
    timeoutMs: 5000,
    dynamicReplanningEnabled: true,
    reflectionEnabled: true,
  };

  // ==================================================
  // 1. Builder Validation
  // ==================================================
  let engine!: PlanningEngine;
  try {
    new PlanningBuilder().build();
    throw new Error("Should fail without context");
  } catch (err: any) {
    assert(err.message.includes("Context is required"), "Throws error for missing context");
  }

  engine = new PlanningBuilder()
    .withContext(context)
    .withConfiguration(configuration)
    .withMetadata({ env: "test" })
    .build();

  assert(engine instanceof PlanningEngine, "Successfully builds PlanningEngine");
  console.log("\n1. Builder Validation\n✓ Passed");

  // ==================================================
  // 2. Lifecycle Validation
  // ==================================================
  // Should throw error when creating plan before start
  try {
    await engine.createPlan({
      id: "plan-1",
      goal: {
        id: "goal-1",
        description: "Test goal",
        priority: GoalPriority.NORMAL,
        type: GoalType.SIMPLE,
        status: GoalStatus.PENDING,
      },
    });
    throw new Error("Should not allow operations before initialize/start");
  } catch (err: any) {
    assert(err.message.includes("valid state"), "Blocked action before initialization");
  }

  await engine.initialize();
  await engine.start();
  console.log("\n2. Lifecycle Validation\n✓ Passed");

  // ==================================================
  // 3. Goal Creation
  // ==================================================
  const simpleGoal = {
    id: "goal-simple",
    description: "Simple test goal",
    priority: GoalPriority.HIGH,
    type: GoalType.SIMPLE,
    status: GoalStatus.PENDING,
  };
  PlanningValidator.validateGoal(simpleGoal);

  const backgroundGoal = {
    id: "goal-bg",
    description: "Background check task",
    priority: GoalPriority.BACKGROUND,
    type: GoalType.BACKGROUND,
    status: GoalStatus.PENDING,
  };
  PlanningValidator.validateGoal(backgroundGoal);

  console.log("\n3. Goal Creation\n✓ Passed");

  // ==================================================
  // 4. Goal Decomposition
  // ==================================================
  const planSeq = await engine.createPlan({
    id: "plan-sequential",
    goal: {
      id: "goal-decomposition-seq",
      description: "sequential-test",
      priority: GoalPriority.NORMAL,
      type: GoalType.COMPOSITE,
      status: GoalStatus.PENDING,
    },
    strategy: PlanningStrategy.SEQUENTIAL,
  });

  assert(planSeq.tasks.length === 3, "Sequential goal decomposes into 3 tasks");
  console.log("\n4. Goal Decomposition\n✓ Passed");

  // ==================================================
  // 5. Task Planning
  // ==================================================
  assert(planSeq.tasks[0].id === "task-1", "Task 1 exists");
  assert(planSeq.tasks[1].dependencies.includes("task-1"), "Task 2 depends on Task 1");
  console.log("\n5. Task Planning\n✓ Passed");

  // ==================================================
  // 6. Sequential Strategy
  // ==================================================
  const execSeq = await engine.execute(planSeq.id);
  assert(execSeq.status === PlanStatus.COMPLETED, "Sequential execution succeeded");
  assert(execSeq.successRate === 100, "100% success rate");
  console.log("\n6. Sequential Strategy\n✓ Passed");

  // ==================================================
  // 7. Parallel Strategy
  // ==================================================
  const planPar = await engine.createPlan({
    id: "plan-parallel",
    goal: {
      id: "goal-decomposition-par",
      description: "parallel-test",
      priority: GoalPriority.NORMAL,
      type: GoalType.COMPOSITE,
      status: GoalStatus.PENDING,
    },
    strategy: PlanningStrategy.PARALLEL,
  });

  const execPar = await engine.execute(planPar.id);
  assert(execPar.status === PlanStatus.COMPLETED, "Parallel execution succeeded");
  console.log("\n7. Parallel Strategy\n✓ Passed");

  // ==================================================
  // 8. Dependency Graph
  // ==================================================
  assert(planSeq.dependencies.length === 2, "Graph has dependencies registered");
  console.log("\n8. Dependency Graph\n✓ Passed");

  // ==================================================
  // 9. Circular Dependency Detection
  // ==================================================
  try {
    await engine.createPlan({
      id: "plan-circular",
      goal: {
        id: "goal-circular",
        description: "circular-test",
        priority: GoalPriority.NORMAL,
        type: GoalType.DEPENDENT,
        status: GoalStatus.PENDING,
      },
    });
    throw new Error("Should fail with circular dependency");
  } catch (err: any) {
    assert(err instanceof PlanningValidationException, "Throws PlanningValidationException");
    assert(err.message.includes("Circular dependency"), "Correct error message");
  }
  console.log("\n9. Circular Dependency Detection\n✓ Passed");

  // ==================================================
  // 10. Reflection Generation
  // ==================================================
  assert(execSeq.reflections.length > 0, "Reflections were generated during execution");
  assert(execSeq.reflections[0].success === true, "Reflection success flag set");
  console.log("\n10. Reflection Generation\n✓ Passed");

  // ==================================================
  // 11. Replanning
  // ==================================================
  // Create a plan that fails a task, causing dynamic replanning
  const planReplan = await engine.createPlan({
    id: "plan-replan-fail",
    goal: {
      id: "goal-replan-fail",
      description: "fail-task-1-dynamic",
      priority: GoalPriority.NORMAL,
      type: GoalType.SIMPLE,
      status: GoalStatus.PENDING,
    },
    strategy: PlanningStrategy.SEQUENTIAL,
  });

  const execReplan = await engine.execute(planReplan.id);
  assert(execReplan.replansCount > 0, "Replanning was triggered");
  console.log("\n11. Replanning\n✓ Passed");

  // ==================================================
  // 12. Retry Planning
  // ==================================================
  assert(execReplan.retries > 0, "Retries were attempted for failing task");
  console.log("\n12. Retry Planning\n✓ Passed");

  // ==================================================
  // 13. Cancellation
  // ==================================================
  const planCancel = await engine.createPlan({
    id: "plan-cancel",
    goal: {
      id: "goal-cancel",
      description: "test-cancellation",
      priority: GoalPriority.NORMAL,
      type: GoalType.SIMPLE,
      status: GoalStatus.PENDING,
    },
  });

  // Start execution and immediately cancel
  const executePromise = engine.execute(planCancel.id);
  await engine.cancel(planCancel.id);
  const execCancelResult = await executePromise;

  assert(execCancelResult.status === PlanStatus.CANCELLED, "Execution is cancelled");
  console.log("\n13. Cancellation\n✓ Passed");

  // ==================================================
  // 14. Resume
  // ==================================================
  const planPauseResume = await engine.createPlan({
    id: "plan-pause-resume",
    goal: {
      id: "goal-pause-resume",
      description: "test-pause-resume",
      priority: GoalPriority.NORMAL,
      type: GoalType.SIMPLE,
      status: GoalStatus.PENDING,
    },
  });

  // Start execution, pause, then resume
  const executePromise2 = engine.execute(planPauseResume.id);
  await new Promise((resolve) => setTimeout(resolve, 2));
  await engine.pause(planPauseResume.id);
  
  // Verify plan status is paused
  const snap1 = engine.snapshot();
  const planRef1 = snap1.plans.find((p) => p.id === planPauseResume.id);
  assert(planRef1?.status === PlanStatus.PAUSED, "Plan transitions to PAUSED");

  await engine.resume(planPauseResume.id);
  const execPauseResumeResult = await executePromise2;
  assert(execPauseResumeResult.status === PlanStatus.COMPLETED, "Plan successfully finished after resume");
  console.log("\n14. Resume\n✓ Passed");

  // ==================================================
  // 15. Pause
  // ==================================================
  console.log("\n15. Pause\n✓ Passed");

  // ==================================================
  // 16. Execution Tracking
  // ==================================================
  assert(execSeq.executionTimeMs !== undefined && execSeq.executionTimeMs >= 0, "Execution time tracked");
  assert(execSeq.planningLatencyMs !== undefined && execSeq.planningLatencyMs >= 0, "Planning latency tracked");
  console.log("\n16. Execution Tracking\n✓ Passed");

  // ==================================================
  // 17. Snapshot Immutability
  // ==================================================
  const snapshot = engine.snapshot();
  assert(Object.isFrozen(snapshot), "Snapshot is frozen");
  assert(Object.isFrozen(snapshot.plans), "Plans list in snapshot is frozen");
  assert(Object.isFrozen(snapshot.executions), "Executions list in snapshot is frozen");
  console.log("\n17. Snapshot Immutability\n✓ Passed");

  // ==================================================
  // 18. Validator Rules
  // ==================================================
  try {
    await engine.createPlan({
      id: "plan-empty-goal",
      goal: {
        id: "goal-empty",
        description: "", // Invalid: Empty Goal
        priority: GoalPriority.NORMAL,
        type: GoalType.SIMPLE,
        status: GoalStatus.PENDING,
      },
    });
    throw new Error("Should fail with empty goal");
  } catch (err: any) {
    assert(err instanceof PlanningValidationException, "Throws PlanningValidationException");
    assert(err.message.includes("description cannot be empty"), "Empty goal check worked");
  }

  try {
    PlanningValidator.validatePriorities("INVALID_PRIORITY");
    throw new Error("Should fail with invalid priority");
  } catch (err: any) {
    assert(err instanceof PlanningValidationException, "Throws PlanningValidationException");
  }

  console.log("\n18. Validator Rules\n✓ Passed");

  console.log("\n=== ALL PLANNING ENGINE TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
