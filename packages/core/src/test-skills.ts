import { LoggerBuilder } from "./logger/LoggerBuilder";
import { EventBus } from "./events/EventBus";
import { ConfigBuilder } from "./config/ConfigBuilder";
import { MemorySource } from "./config/MemorySource";
import { RegistryBuilder } from "./registry/RegistryBuilder";
import { MemoryStore } from "./memory/MemoryStore";
import { AgentBuilder } from "./agents/AgentBuilder";
import { AgentRegistry } from "./agents/AgentRegistry";
import { WorkflowBuilder } from "./workflow/WorkflowBuilder";
import { WorkflowEngine } from "./workflow/WorkflowEngine";
import { PlanningBuilder } from "./planning/PlanningBuilder";
import { PlanningStrategy } from "./planning/PlanningStrategy";
import { JsonFormatter } from "./logger/LogFormatter";
import { JobPriority } from "./jobs/JobPriority";
import * as path from "path";

// Skill module imports
import {
  SkillBuilder,
  SkillState,
  SkillType,
  SkillScope,
  SkillVisibility,
  SkillRegistry,
  SkillLoader,
  SkillValidator,
  SkillException,
  SkillValidationException,
  DuplicateSkillException,
  SkillDependencyException,
  InvalidSkillStateException,
} from "./skills/index";

class SilentTransport {
  public send(): void {}
}

import { AgentLifecycle } from "./agents/AgentLifecycle";

class DummyAgentLifecycle implements AgentLifecycle {
  public async initialize(): Promise<void> {}
  public async execute(context: any, input?: any): Promise<any> {
    return input;
  }
  public async shutdown(): Promise<void> {}
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
  console.log("=== START AUTONOMOUS AGENT SKILL SYSTEM TESTS ===");

  // Platform DI Setup
  const eventBus = new EventBus(logger);
  const schema = {
    permissions: { type: "any" as any, required: false },
  };
  const config = await new ConfigBuilder(schema)
    .withSource(new MemorySource({
      permissions: ["use-system", "read-files", "generate-images"],
    }))
    .build();
  const serviceRegistry = new RegistryBuilder().build();
  const memoryStore = new MemoryStore();
  const agentRegistry = new AgentRegistry();

  const skillContext = {
    logger,
    config,
    registry: serviceRegistry,
    eventBus,
    memoryStore,
  };

  const agentContext = {
    logger,
    config,
    registry: serviceRegistry,
    eventBus,
    jobEngine: {} as any,
    memoryStore,
    agentRegistry,
  };

  // Helper mock executors
  const dummyExecutor = async (input: any) => {
    return { val: (input?.val || 0) * 2 };
  };

  const failingExecutor = async () => {
    throw new Error("Simulated skill execution error");
  };

  // ==================================================
  // 1. Builder Validation
  // ==================================================
  console.log("\n1. Verifying Skill Builder...");
  {
    try {
      new SkillBuilder().build();
      throw new Error("Should not allow building empty skill");
    } catch (err: any) {
      assert(err.message.includes("Skill ID is required"), "Checks ID presence");
    }

    const builtSkill = new SkillBuilder()
      .withId("test-builder-skill")
      .withName("Builder Skill")
      .withDescription("A skill built with builder")
      .withVersion("1.2.3")
      .withAuthor("Test Author")
      .withType(SkillType.UTILITY)
      .withScope(SkillScope.GLOBAL)
      .withVisibility(SkillVisibility.PUBLIC)
      .withTags(["tag1", "tag2"])
      .withContext(skillContext)
      .withExecutor(dummyExecutor)
      .build();

    assert(builtSkill.id === "test-builder-skill", "ID set correctly");
    assert(builtSkill.name === "Builder Skill", "Name set correctly");
    assert(builtSkill.description === "A skill built with builder", "Description set correctly");
    assert(builtSkill.state === SkillState.CREATED, "State is initially CREATED");
    assert(
      builtSkill.manifest.metadata.version.toString() === "1.2.3",
      "Version parsed and stored"
    );
    console.log("   ✓ Builder validated successfully.");
  }

  // ==================================================
  // 2. Lifecycle States
  // ==================================================
  console.log("\n2. Verifying Skill Lifecycle Transitions...");
  {
    const skill = new SkillBuilder()
      .withId("test-lifecycle")
      .withName("Lifecycle Skill")
      .withContext(skillContext)
      .withExecutor(dummyExecutor)
      .build();

    assert(skill.state === SkillState.CREATED, "Starts in CREATED");

    // execute before initialize should fail
    try {
      await skill.execute();
      throw new Error("Should not execute in CREATED state");
    } catch (err) {
      assert(err instanceof InvalidSkillStateException, "Throws InvalidSkillStateException");
    }

    await skill.initialize();
    assert(skill.state === SkillState.READY, "Transitions to READY");

    const result = await skill.execute({ val: 5 });
    assert(result.success === true, "Execution succeeded");
    assert(result.output.val === 10, "Executor computed correct output");
    assert(skill.state === SkillState.READY, "Transitions back to READY after running");

    await skill.stop();
    assert(skill.state === SkillState.STOPPED, "Transitions to STOPPED");

    // execute after stopped should fail
    try {
      await skill.execute();
      throw new Error("Should not execute in STOPPED state");
    } catch (err) {
      assert(err instanceof InvalidSkillStateException, "Throws InvalidSkillStateException");
    }

    // transition failed executor state
    const badSkill = new SkillBuilder()
      .withId("test-lifecycle-fail")
      .withName("Failing Lifecycle Skill")
      .withContext(skillContext)
      .withExecutor(failingExecutor)
      .build();

    await badSkill.initialize();
    const badResult = await badSkill.execute();
    assert(badResult.success === false, "Reports failed execution");
    assert(badSkill.state === SkillState.FAILED, "Transitions to FAILED state");
    console.log("   ✓ Lifecycle transitions verified.");
  }

  // ==================================================
  // 3. Registry Operations
  // ==================================================
  console.log("\n3. Verifying Registry Operations...");
  {
    const registry = new SkillRegistry(skillContext);
    const skill = new SkillBuilder()
      .withId("registry-skill")
      .withName("Registry Skill")
      .withContext(skillContext)
      .withExecutor(dummyExecutor)
      .build();

    assert(registry.has("registry-skill") === false, "Initially empty");
    await registry.register(skill);
    assert(registry.has("registry-skill") === true, "Registry tracks registered skill");
    assert(registry.get("registry-skill") === skill, "Retrieved skill matches registered");
    assert(registry.list().length === 1, "List reports registered skill");

    // Duplicate registration should throw
    try {
      await registry.register(skill);
      throw new Error("Should throw on duplicate registration");
    } catch (err) {
      assert(err instanceof DuplicateSkillException, "DuplicateSkillException thrown");
    }

    // Search operations
    const searchRes = registry.search("Registry");
    assert(searchRes.length === 1 && searchRes[0].id === "registry-skill", "Search matches name");

    await registry.unregister("registry-skill");
    assert(registry.has("registry-skill") === false, "Removed after unregister");
    console.log("   ✓ Registry operations verified.");
  }

  // ==================================================
  // 4. installSkill on Agent
  // ==================================================
  console.log("\n4. Verifying installSkill on Agent...");
  {
    const agent = new AgentBuilder()
      .withId("agent-skills-1")
      .withName("Skills Agent")
      .withContext(agentContext)
      .withLifecycle(new DummyAgentLifecycle())
      .build();

    const skill = new SkillBuilder()
      .withId("agent-skill-id")
      .withName("Agent Skill")
      .withContext(skillContext)
      .withExecutor(dummyExecutor)
      .build();

    await agent.installSkill(skill);
    assert(agent.listSkills().length === 1, "Agent lists 1 installed skill");
    assert(agent.listSkills()[0] === skill, "Skill matches");
    assert(skill.state === SkillState.READY, "Skill is automatically initialized & READY");
    console.log("   ✓ installSkill verified.");
  }

  // ==================================================
  // 5. removeSkill from Agent
  // ==================================================
  console.log("\n5. Verifying removeSkill from Agent...");
  {
    const agent = new AgentBuilder()
      .withId("agent-skills-2")
      .withName("Skills Agent")
      .withContext(agentContext)
      .withLifecycle(new DummyAgentLifecycle())
      .build();

    const skill = new SkillBuilder()
      .withId("agent-skill-id-2")
      .withName("Agent Skill 2")
      .withContext(skillContext)
      .withExecutor(dummyExecutor)
      .build();

    await agent.installSkill(skill);
    assert(agent.listSkills().length === 1, "Skill installed");
    await agent.removeSkill("agent-skill-id-2");
    assert(agent.listSkills().length === 0, "Skill removed from agent list");
    assert(skill.state === SkillState.STOPPED, "Removed skill is stopped");
    console.log("   ✓ removeSkill verified.");
  }

  // ==================================================
  // 6. enableSkill on Agent
  // ==================================================
  console.log("\n6. Verifying enableSkill on Agent...");
  {
    const agent = new AgentBuilder()
      .withId("agent-skills-3")
      .withName("Skills Agent")
      .withContext(agentContext)
      .withLifecycle(new DummyAgentLifecycle())
      .build();

    const skill = new SkillBuilder()
      .withId("agent-skill-id-3")
      .withName("Agent Skill 3")
      .withContext(skillContext)
      .withExecutor(dummyExecutor)
      .build();

    await agent.installSkill(skill);
    // Explicitly enable (should succeed silently since enabled by default)
    await agent.enableSkill("agent-skill-id-3");
    const out = await agent.executeSkill("agent-skill-id-3", { val: 4 });
    assert((out as any).val === 8, "Skill runs when enabled");
    console.log("   ✓ enableSkill verified.");
  }

  // ==================================================
  // 7. disableSkill on Agent
  // ==================================================
  console.log("\n7. Verifying disableSkill on Agent...");
  {
    const agent = new AgentBuilder()
      .withId("agent-skills-4")
      .withName("Skills Agent")
      .withContext(agentContext)
      .withLifecycle(new DummyAgentLifecycle())
      .build();

    const skill = new SkillBuilder()
      .withId("agent-skill-id-4")
      .withName("Agent Skill 4")
      .withContext(skillContext)
      .withExecutor(dummyExecutor)
      .build();

    await agent.installSkill(skill);
    await agent.disableSkill("agent-skill-id-4");

    try {
      await agent.executeSkill("agent-skill-id-4", { val: 4 });
      throw new Error("Should not execute disabled skill");
    } catch (err: any) {
      assert(err.message.includes("disabled"), "Execution blocked for disabled skill");
    }
    console.log("   ✓ disableSkill verified.");
  }

  // ==================================================
  // 8. Loader (Dynamic Manifest Loading)
  // ==================================================
  console.log("\n8. Verifying Loader (Dynamic Manifest)...");
  {
    const loader = new SkillLoader();
    const manifestPath = path.join(
      process.cwd(),
      "packages",
      "core",
      "src",
      "skills",
      "temp-test-skill",
      "manifest.json"
    );

    const loadedSkill = await loader.loadFromManifest(manifestPath, skillContext);
    assert(loadedSkill.id === "dynamic-test-skill", "Correctly parsed manifest ID");
    assert(loadedSkill.state === SkillState.READY, "Skill automatically moved to READY");

    const execRes = await loadedSkill.execute({ val: 21 });
    assert(execRes.success === true, "Execution succeeded");
    assert(execRes.output.status === "dynamically-loaded-success", "Result status matched");
    assert(execRes.output.val === 21, "Result echoed input parameter");
    console.log("   ✓ Loader manifest verified.");
  }

  // ==================================================
  // 9. Dynamic Directory Loading
  // ==================================================
  console.log("\n9. Verifying Loader (Dynamic Directory)...");
  {
    const loader = new SkillLoader();
    const skillsDir = path.join(process.cwd(), "packages", "core", "src", "skills");

    const loadedSkills = await loader.loadDirectory(skillsDir, skillContext);
    assert(loadedSkills.length >= 1, "Loads at least 1 skill folder");
    assert(
      loadedSkills.some((s) => s.id === "dynamic-test-skill"),
      "Found dynamic-test-skill inside the directory"
    );
    console.log("   ✓ Loader directory verified.");
  }

  // ==================================================
  // 10. Dependency Resolution
  // ==================================================
  console.log("\n10. Verifying Dependency Resolution...");
  {
    const registry = new SkillRegistry(skillContext);
    const skillA = new SkillBuilder()
      .withId("skill-a")
      .withName("Skill A")
      .withVersion("1.0.0")
      .withContext(skillContext)
      .withExecutor(dummyExecutor)
      .build();

    const skillB = new SkillBuilder()
      .withId("skill-b")
      .withName("Skill B")
      .withVersion("1.0.0")
      .addDependency({ skillId: "skill-a", versionRange: "^1.0.0" })
      .withContext(skillContext)
      .withExecutor(dummyExecutor)
      .build();

    // Register B first (should fail because A is missing)
    try {
      await registry.register(skillB);
      throw new Error("Should not allow registering B without dependency A");
    } catch (err) {
      assert(err instanceof SkillDependencyException, "Throws SkillDependencyException");
    }

    // Register A then B
    await registry.register(skillA);
    await registry.register(skillB);

    assert(registry.has("skill-b"), "Successfully registers when dependency resolved");
    console.log("   ✓ Dependency resolution verified.");
  }

  // ==================================================
  // 11. Version Compatibility Ranges
  // ==================================================
  console.log("\n11. Verifying Version Compatibility Checks...");
  {
    const registry = new SkillRegistry(skillContext);
    const skillA = new SkillBuilder()
      .withId("skill-a-ver")
      .withName("Skill A")
      .withVersion("2.1.0")
      .withContext(skillContext)
      .withExecutor(dummyExecutor)
      .build();

    const skillB = new SkillBuilder()
      .withId("skill-b-ver")
      .withName("Skill B")
      .withVersion("1.0.0")
      .addDependency({ skillId: "skill-a-ver", versionRange: "^1.0.0" }) // incompatible with 2.1.0
      .withContext(skillContext)
      .withExecutor(dummyExecutor)
      .build();

    await registry.register(skillA);
    try {
      await registry.register(skillB);
      throw new Error("Should reject incompatible version dependency");
    } catch (err: any) {
      assert(
        err.message.includes("satisfy range"),
        "Correctly captures version range mismatch"
      );
    }
    console.log("   ✓ Version compatibility verified.");
  }

  // ==================================================
  // 12. Execution Success
  // ==================================================
  console.log("\n12. Verifying Skill Execution Metrics...");
  {
    const registry = new SkillRegistry(skillContext);
    const skill = new SkillBuilder()
      .withId("skill-exec")
      .withName("Exec Skill")
      .withContext(skillContext)
      .withExecutor(dummyExecutor)
      .build();

    await registry.register(skill);
    await registry.load("skill-exec");

    const execRes = await registry.execute("skill-exec", { val: 50 });
    assert(execRes.success === true, "Execution report reports success");
    assert(execRes.output.val === 100, "Executor outputs correct value");
    assert(execRes.runtimeMs >= 0, "Execution computes runtimeMs metrics");
    console.log("   ✓ Execution metrics verified.");
  }

  // ==================================================
  // 13. Workflow Integration
  // ==================================================
  console.log("\n13. Verifying Workflow Step Integration...");
  {
    const registry = new SkillRegistry(skillContext);
    const skill = new SkillBuilder()
      .withId("skill-wf")
      .withName("Workflow Skill")
      .withContext(skillContext)
      .withExecutor(async (input) => `${input} -> processed-by-skill`)
      .build();

    await registry.register(skill);
    await registry.load("skill-wf");

    // Build context with skillRegistry included
    const workflowCtx = {
      ...agentContext,
      skillRegistry: registry,
    };

    const workflow = new WorkflowBuilder()
      .withName("SkillStepWorkflow")
      .withContext(workflowCtx)
      .addStep({
        id: "step-skill-1",
        name: "Run Skill Step",
        skillId: "skill-wf",
        priority: JobPriority.NORMAL,
        input: "hello-world",
      })
      .build();

    const workflowEngine = new WorkflowEngine();
    workflowEngine.register(workflow);
    const finalOutput = await workflowEngine.execute(workflow.id);

    assert(finalOutput === "hello-world -> processed-by-skill", "Skill output successfully collected");
    assert(workflow.steps[0].status === "COMPLETED", "Step status COMPLETED");
    console.log("   ✓ Workflow step execution verified.");
  }

  // ==================================================
  // 14. Planner Integration (Choices Selection)
  // ==================================================
  console.log("\n14. Verifying Planner Integration...");
  {
    const planner = new PlanningBuilder().withContext(skillContext).build();
    await planner.initialize();
    await planner.start();

    const plan = await planner.createPlan({
      id: "plan-skills-test",
      goal: {
        id: "goal-skills",
        description: "choose-skill for execution",
        priority: "NORMAL" as any,
        type: "SIMPLE" as any,
        status: "PENDING" as any,
      },
    });

    assert(plan.tasks[0].choice !== undefined, "PlanTask contains a choice object");
    assert(plan.tasks[0].choice?.type === "skill", "Choice type resolved to skill");
    assert(plan.tasks[0].choice?.targetId === "test-skill", "Choice targetId matches");
    assert(!!plan.tasks[0].skills?.includes("test-skill"), "Choice added to skills list");

    const planTool = await planner.createPlan({
      id: "plan-tools-test",
      goal: {
        id: "goal-tools",
        description: "choose-tool for execution",
        priority: "NORMAL" as any,
        type: "SIMPLE" as any,
        status: "PENDING" as any,
      },
    });

    assert(planTool.tasks[0].choice?.type === "tool", "Choice type resolved to tool");
    assert(planTool.tasks[0].choice?.targetId === "test-tool", "Choice targetId matches");
    assert(!!planTool.tasks[0].tools?.includes("test-tool"), "Choice added to tools list");
    console.log("   ✓ Planner choices verified.");
  }

  // ==================================================
  // 15. Agent executeSkill Integration
  // ==================================================
  console.log("\n15. Verifying Agent executeSkill Integration...");
  {
    const agent = new AgentBuilder()
      .withId("agent-exec-skill")
      .withName("Exec Skill Agent")
      .withContext(agentContext)
      .withLifecycle(new DummyAgentLifecycle())
      .build();

    const skill = new SkillBuilder()
      .withId("skill-agent-direct")
      .withName("Agent Direct Skill")
      .withContext(skillContext)
      .withExecutor(dummyExecutor)
      .build();

    await agent.installSkill(skill);
    const output = await agent.executeSkill("skill-agent-direct", { val: 12 });
    assert((output as any).val === 24, "Direct skill execution via agent works");
    console.log("   ✓ Agent executeSkill verified.");
  }

  // ==================================================
  // 16. Event Publishing
  // ==================================================
  console.log("\n16. Verifying Event Bus Publishing...");
  {
    const publishedEvents: string[] = [];
    eventBus.subscribe("*", async (event) => {
      publishedEvents.push(event.name);
    });

    const registry = new SkillRegistry(skillContext);
    const skill = new SkillBuilder()
      .withId("event-skill")
      .withName("Event Skill")
      .withContext(skillContext)
      .withExecutor(dummyExecutor)
      .build();

    await registry.register(skill); // should publish SkillInstalled
    await registry.load("event-skill"); // should publish SkillLoaded
    await registry.execute("event-skill", { val: 2 }); // should publish SkillExecuted
    await registry.unload("event-skill"); // should publish SkillUnloaded

    assert(publishedEvents.includes("SkillInstalled"), "SkillInstalled event published");
    assert(publishedEvents.includes("SkillLoaded"), "SkillLoaded event published");
    assert(publishedEvents.includes("SkillExecuted"), "SkillExecuted event published");
    assert(publishedEvents.includes("SkillUnloaded"), "SkillUnloaded event published");

    // Failing execution publishes SkillFailed
    const failingSkill = new SkillBuilder()
      .withId("failing-event-skill")
      .withName("Failing Event Skill")
      .withContext(skillContext)
      .withExecutor(failingExecutor)
      .build();

    await registry.register(failingSkill);
    await registry.load("failing-event-skill");
    await registry.execute("failing-event-skill");

    assert(publishedEvents.includes("SkillFailed"), "SkillFailed event published");
    console.log("   ✓ Event publishing verified.");
  }

  // ==================================================
  // 17. Memory Recording
  // ==================================================
  console.log("\n17. Verifying Memory Engine Storage...");
  {
    const registry = new SkillRegistry(skillContext);
    const skill = new SkillBuilder()
      .withId("mem-skill")
      .withName("Memory Skill")
      .withContext(skillContext)
      .withExecutor(dummyExecutor)
      .build();

    await registry.register(skill);
    await registry.load("mem-skill");

    await registry.execute("mem-skill", { val: 2 });
    await registry.execute("mem-skill", { val: 4 });

    const key = "mem-skill:history";
    const entry = await memoryStore.get("skills", key);

    assert(entry !== undefined, "Memory entry found in MemoryStore under 'skills' namespace");
    if (!entry) throw new Error("Entry not found");
    const val = entry.value as any;
    assert(val.executionHistory.length === 2, "Execution history has 2 records");
    assert(val.successRate === 100, "Reports 100% success rate");
    assert(val.averageRuntime >= 0, "Reports average runtime metric");
    assert(typeof val.lastExecution === "string" && !isNaN(Date.parse(val.lastExecution)), "Reports lastExecution timestamp");
    console.log("   ✓ Memory recording verified.");
  }

  // ==================================================
  // 18. Snapshot Immutability
  // ==================================================
  console.log("\n18. Verifying Snapshot Immutability...");
  {
    const registry = new SkillRegistry(skillContext);
    const skill = new SkillBuilder()
      .withId("snap-skill")
      .withName("Snapshot Skill")
      .withContext(skillContext)
      .withExecutor(dummyExecutor)
      .build();

    await registry.register(skill);
    const snap = registry.snapshot();

    assert(Object.isFrozen(snap), "Snapshot is frozen");
    assert(Object.isFrozen(snap.skills), "Snapshot skills list is frozen");
    assert(Object.isFrozen(snap.skills[0]), "Snapshot skill elements are frozen");

    try {
      (snap as any).count = 50;
      throw new Error("Should not allow modifications");
    } catch (e) {
      // Caught modification error successfully
    }
    console.log("   ✓ Snapshot immutability verified.");
  }

  // ==================================================
  // 19. Validator Rules - Circular Dependency Detection
  // ==================================================
  console.log("\n19. Verifying Validator Circular Dependencies...");
  {
    const skillA = new SkillBuilder()
      .withId("cycle-a")
      .withName("Skill A")
      .addDependency({ skillId: "cycle-b", versionRange: "*" })
      .withContext(skillContext)
      .withExecutor(dummyExecutor)
      .build();

    const skillB = new SkillBuilder()
      .withId("cycle-b")
      .withName("Skill B")
      .addDependency({ skillId: "cycle-a", versionRange: "*" })
      .withContext(skillContext)
      .withExecutor(dummyExecutor)
      .build();

    const skills = [skillA, skillB];
    try {
      SkillValidator.validateDependencies(skills);
      throw new Error("Should fail with cycle detection");
    } catch (err: any) {
      assert(err instanceof SkillDependencyException, "Throws SkillDependencyException");
      assert(err.message.includes("cycle"), "Captured cycle error message");
    }
    console.log("   ✓ Circular dependency validator rule verified.");
  }

  // ==================================================
  // 20. Validator Rules - Parameter Validation & Permissions
  // ==================================================
  console.log("\n20. Verifying Validator Parameters & Permissions...");
  {
    const registry = new SkillRegistry(skillContext);
    const skill = new SkillBuilder()
      .withId("perm-param-skill")
      .withName("Permissions Skill")
      .addCapability({
        name: "process",
        description: "process something",
        parameters: [
          { name: "val", type: "number", description: "a number", required: true },
          { name: "str", type: "string", description: "a string", required: false },
        ],
      })
      .addPermission({ name: "use-system", actions: ["exec"] })
      .addPermission({ name: "generate-images", actions: ["create"] })
      .withContext(skillContext)
      .withExecutor(dummyExecutor)
      .build();

    await registry.register(skill);
    await registry.load("perm-param-skill");

    // Missing required parameter "val"
    try {
      await registry.execute("perm-param-skill", {});
      throw new Error("Should fail parameter validation");
    } catch (err: any) {
      assert(err instanceof SkillValidationException, "Throws SkillValidationException");
      assert(err.message.includes("Missing required parameter"), "Missing parameter caught");
    }

    // Invalid parameter type (string instead of number)
    try {
      await registry.execute("perm-param-skill", { val: "not-a-number" });
      throw new Error("Should fail parameter type validation");
    } catch (err: any) {
      assert(err instanceof SkillValidationException, "Throws SkillValidationException");
      assert(err.message.includes("must be a number"), "Invalid parameter type caught");
    }

    // Missing permissions validation
    const restrictedConfig = await new ConfigBuilder(schema)
      .withSource(new MemorySource({
        permissions: ["use-system"],
      }))
      .build();

    const restrictedContext = {
      ...skillContext,
      config: restrictedConfig,
    };

    const restrictedRegistry = new SkillRegistry(restrictedContext);
    await restrictedRegistry.register(skill);
    await restrictedRegistry.load("perm-param-skill");

    try {
      await restrictedRegistry.execute("perm-param-skill", { val: 42 });
      throw new Error("Should fail permission validation");
    } catch (err: any) {
      assert(err instanceof SkillValidationException, "Throws SkillValidationException");
      assert(err.message.includes("Missing required permission"), "Missing permission caught");
    }
    console.log("   ✓ Parameter and permission validator rules verified.");
  }

  console.log("\n=== ALL 20/20 SKILL FRAMEWORK TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err: any) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
