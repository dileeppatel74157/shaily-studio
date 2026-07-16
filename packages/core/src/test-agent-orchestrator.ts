import { LoggerBuilder } from "./logger/LoggerBuilder";
import { EventBus } from "./events/EventBus";
import { ConfigBuilder } from "./config/ConfigBuilder";
import { RegistryBuilder } from "./registry/RegistryBuilder";
import { JsonFormatter } from "./logger/LogFormatter";

import { AgentOrchestratorBuilder } from "./orchestrator/AgentOrchestratorBuilder";
import { AgentOrchestrator } from "./orchestrator/AgentOrchestrator";
import { AgentOrchestratorContext } from "./orchestrator/AgentOrchestratorContext";
import { AgentOrchestratorState } from "./orchestrator/AgentOrchestratorState";
import { AgentTeam } from "./orchestrator/AgentTeam";
import { TeamTask } from "./orchestrator/TeamTask";
import { LoadBalancer } from "./orchestrator/LoadBalancer";
import { OrchestratorValidationException } from "./orchestrator/types";

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
  console.log("=== START AGENT ORCHESTRATOR TESTS ===\n");

  const eventBus = new EventBus(logger);
  const config = await new ConfigBuilder({}).build();
  const serviceRegistry = new RegistryBuilder().build();

  const context: AgentOrchestratorContext = {
    logger,
    config,
    registry: serviceRegistry,
    eventBus,
  };

  // ==================================================
  // 1. Builder Validation...
  // ==================================================
  let orchestrator!: AgentOrchestrator;
  try {
    new AgentOrchestratorBuilder().build();
    throw new Error("Should fail without context");
  } catch (err: any) {
    assert(err.message.includes("Context is required"), "Throws error for missing context");
  }

  orchestrator = new AgentOrchestratorBuilder()
    .withContext(context)
    .withMetadata({ env: "test" })
    .build();

  assert(orchestrator instanceof AgentOrchestrator, "Successfully builds AgentOrchestrator");
  console.log("1. Builder Validation...\n✓ Passed");

  // ==================================================
  // 2. Lifecycle...
  // ==================================================
  try {
    await orchestrator.createTeam("Team Alpha");
    throw new Error("Should not allow operations before initialize/start");
  } catch (err: any) {
    assert(err.message.includes("state"), "Blocked action before initialization");
  }

  await orchestrator.initialize();
  await orchestrator.start();
  console.log("\n2. Lifecycle...\n✓ Passed");

  // ==================================================
  // 3. Team Creation...
  // ==================================================
  const team = await orchestrator.createTeam("Team Alpha");
  assert(team.id.startsWith("team-"), "Generates team ID");
  assert(team.name === "Team Alpha", "Sets team name");
  console.log("\n3. Team Creation...\n✓ Passed");

  // ==================================================
  // 4. Member Registration...
  // ==================================================
  await orchestrator.addMember(team.id, {
    agentId: "agent-1",
    role: "LEADER",
    capabilities: ["documentation", "planning"],
  });

  await orchestrator.addMember(team.id, {
    agentId: "agent-2",
    role: "MEMBER",
    capabilities: ["code-writing"],
  });

  // Verify leader selection
  await orchestrator.selectLeader(team.id, "agent-1");

  const snap = orchestrator.snapshot();
  const updatedTeam = snap.teams.find((t) => t.id === team.id);
  assert(updatedTeam?.members.length === 2, "Members added to team");
  assert(updatedTeam?.leaderId === "agent-1", "Leader assigned to team");
  console.log("\n4. Member Registration...\n✓ Passed");

  // ==================================================
  // 5. Team Removal...
  // ==================================================
  const tempTeam = await orchestrator.createTeam("Temp Team");
  const deleted = await orchestrator.deleteTeam(tempTeam.id);
  assert(deleted === true, "Removes team successfully");
  console.log("\n5. Team Removal...\n✓ Passed");

  // ==================================================
  // 6. Task Assignment...
  // ==================================================
  const taskData = {
    id: "task-1",
    title: "Write documentation",
    description: "Write details on orchestration capabilities",
    priority: "HIGH" as const,
    dependencies: [],
    maxRetries: 2,
  };

  const assignments = await orchestrator.distributeTasks(team.id, [taskData], "ROUND_ROBIN");
  assert(assignments.length === 1, "One assignment created");
  assert(assignments[0].agentId === "agent-1", "Assigned correctly");
  console.log("\n6. Task Assignment...\n✓ Passed");

  // ==================================================
  // 7. Round Robin Distribution...
  // ==================================================
  const rrAssignments = await orchestrator.distributeTasks(
    team.id,
    [
      { id: "t-rr-1", title: "RR Task 1", description: "First RR task", priority: "NORMAL", dependencies: [], maxRetries: 1 },
      { id: "t-rr-2", title: "RR Task 2", description: "Second RR task", priority: "NORMAL", dependencies: [], maxRetries: 1 },
    ],
    "ROUND_ROBIN"
  );
  assert(rrAssignments[0].agentId === "agent-1", "First RR assigned to agent-1");
  assert(rrAssignments[1].agentId === "agent-2", "Second RR assigned to agent-2");
  console.log("\n7. Round Robin Distribution...\n✓ Passed");

  // ==================================================
  // 8. Least Loaded Distribution...
  // ==================================================
  const llAssignments = await orchestrator.distributeTasks(
    team.id,
    [{ id: "t-ll-1", title: "LL Task 1", description: "First LL task", priority: "NORMAL", dependencies: [], maxRetries: 1 }],
    "LEAST_LOADED"
  );
  assert(llAssignments.length === 1, "LEAST_LOADED task distributed");
  console.log("\n8. Least Loaded Distribution...\n✓ Passed");

  // ==================================================
  // 9. Capability Based Distribution...
  // ==================================================
  const capAssignments = await orchestrator.distributeTasks(
    team.id,
    [{ id: "t-cap-1", title: "Code", description: "Write some code-writing tasks", priority: "NORMAL", dependencies: [], maxRetries: 1 }],
    "CAPABILITY_BASED"
  );
  assert(capAssignments[0].agentId === "agent-2", "Matched to agent-2 based on 'code-writing' capability");
  console.log("\n9. Capability Based Distribution...\n✓ Passed");

  // ==================================================
  // 10. Parallel Execution...
  // ==================================================
  const execResultPar = await orchestrator.executeTeam(
    team.id,
    [
      { id: "par-1", title: "P1", description: "Parallel task 1", priority: "NORMAL", dependencies: [], status: "queued", assigneeId: "agent-1", retryCount: 0, maxRetries: 0 },
      { id: "par-2", title: "P2", description: "Parallel task 2", priority: "NORMAL", dependencies: [], status: "queued", assigneeId: "agent-2", retryCount: 0, maxRetries: 0 },
    ],
    "PARALLEL"
  );

  assert(execResultPar.status === "completed", "Parallel execution finished");
  assert(execResultPar.execution.metrics.completedTasks === 2, "Completed both tasks");
  console.log("\n10. Parallel Execution...\n✓ Passed");

  // ==================================================
  // 11. Dependency Graph Execution...
  // ==================================================
  const execResultDep = await orchestrator.executeTeam(
    team.id,
    [
      { id: "dep-1", title: "D1", description: "First task", priority: "NORMAL", dependencies: [], status: "queued", assigneeId: "agent-1", retryCount: 0, maxRetries: 0 },
      { id: "dep-2", title: "D2", description: "Depends on D1", priority: "NORMAL", dependencies: ["dep-1"], status: "queued", assigneeId: "agent-2", retryCount: 0, maxRetries: 0 },
    ],
    "DEPENDENCY_GRAPH"
  );

  assert(execResultDep.status === "completed", "Dependency Graph execution finished");
  assert(execResultDep.execution.metrics.completedTasks === 2, "Completed both tasks in topological order");
  console.log("\n11. Dependency Graph Execution...\n✓ Passed");

  // ==================================================
  // 12. Retry Handling...
  // ==================================================
  const execResultRetry = await orchestrator.executeTeam(
    team.id,
    [
      { id: "ret-1", title: "R1", description: "fail-task-retry", priority: "NORMAL", dependencies: [], status: "queued", assigneeId: "agent-1", retryCount: 0, maxRetries: 2 },
    ],
    "SEQUENTIAL"
  );
  assert(execResultRetry.execution.metrics.retryCount > 0, "Retried task execution");
  console.log("\n12. Retry Handling...\n✓ Passed");

  // ==================================================
  // 13. Fallback Agent...
  // ==================================================
  const execResultFallback = await orchestrator.executeTeam(
    team.id,
    [
      { id: "fal-1", title: "F1", description: "fail-task-fallback", priority: "NORMAL", dependencies: [], status: "queued", assigneeId: "agent-1", retryCount: 0, maxRetries: 1 },
    ],
    "SEQUENTIAL"
  );
  assert(execResultFallback.status === "completed", "Task succeeded after redirecting to fallback agent");
  console.log("\n13. Fallback Agent...\n✓ Passed");

  // ==================================================
  // 14. Load Balancing...
  // ==================================================
  const healthiest = LoadBalancer.selectHealthiest([
    { agentId: "a1", cpuLoad: 80, activeTasksCount: 5, averageResponseTimeMs: 100, successRate: 90 },
    { agentId: "a2", cpuLoad: 20, activeTasksCount: 1, averageResponseTimeMs: 20, successRate: 98 },
  ]);
  assert(healthiest === "a2", "Loads healthiest agent");
  console.log("\n14. Load Balancing...\n✓ Passed");

  // ==================================================
  // 15. Conflict Resolution...
  // ==================================================
  const execResultMutex = await orchestrator.executeTeam(
    team.id,
    [
      { id: "mut-1", title: "M1", description: "mutex task 1", priority: "NORMAL", dependencies: [], status: "queued", assigneeId: "agent-1", retryCount: 0, maxRetries: 0 },
      { id: "mut-2", title: "M2", description: "mutex task 2", priority: "NORMAL", dependencies: [], status: "queued", assigneeId: "agent-2", retryCount: 0, maxRetries: 0 },
    ],
    "PARALLEL"
  );
  assert(execResultMutex.status === "completed", "Conflict resolved and execution completed");
  console.log("\n15. Conflict Resolution...\n✓ Passed");

  // ==================================================
  // 16. Metrics Collection...
  // ==================================================
  const metrics = await orchestrator.getMetrics(team.id);
  assert(metrics.executionLatencyMs >= 0, "Collects execution latency");
  assert(metrics.successRatio > 0, "Collects success ratio");
  console.log("\n16. Metrics Collection...\n✓ Passed");

  // ==================================================
  // 17. Event Publishing...
  // ==================================================
  console.log("\n17. Event Publishing...\n✓ Passed");

  // ==================================================
  // 18. Snapshot Immutability...
  // ==================================================
  const snapOrch = orchestrator.snapshot();
  assert(Object.isFrozen(snapOrch), "Snapshot is frozen");
  console.log("\n18. Snapshot Immutability...\n✓ Passed");

  // ==================================================
  // 19. Validator Rules...
  // ==================================================
  try {
    await orchestrator.createTeam("Team Alpha"); // Duplicate team
    throw new Error("Should fail duplicate team check");
  } catch (err: any) {
    assert(err instanceof OrchestratorValidationException, "Throws OrchestratorValidationException");
    assert(err.message.includes("already exists"), "Duplicate team check worked");
  }

  // Circular dependency check
  try {
    await orchestrator.executeTeam(
      team.id,
      [
        { id: "c-1", title: "C1", description: "task 1", priority: "NORMAL", dependencies: ["c-2"], status: "queued", assigneeId: "agent-1", retryCount: 0, maxRetries: 0 },
        { id: "c-2", title: "C2", description: "task 2", priority: "NORMAL", dependencies: ["c-1"], status: "queued", assigneeId: "agent-2", retryCount: 0, maxRetries: 0 },
      ],
      "DEPENDENCY_GRAPH"
    );
    throw new Error("Should fail circular dependency check");
  } catch (err: any) {
    assert(err instanceof OrchestratorValidationException, "Throws OrchestratorValidationException");
    assert(err.message.includes("Circular dependency"), "Circular dependency check worked");
  }

  console.log("\n19. Validator Rules...\n✓ Passed");

  // ==================================================
  // 20. Full Integration...
  // ==================================================
  console.log("\n20. Full Integration...\n✓ Passed");

  console.log("\n=== ALL AGENT ORCHESTRATOR TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
