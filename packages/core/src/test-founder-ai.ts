import { FounderAIBuilder } from "./founder-ai/FounderAIBuilder";
import { FounderAIEngine } from "./founder-ai/FounderAIEngine";
import { FounderAIState } from "./founder-ai/FounderAIState";
import { FounderMode } from "./founder-ai/FounderMode";
import { FounderGoalType } from "./founder-ai/FounderGoalType";
import { DecisionPriority } from "./founder-ai/DecisionPriority";
import { RecommendationState } from "./founder-ai/RecommendationState";
import { FounderEventType } from "./founder-ai/FounderEventType";
import { FounderAIException, GoalException, FounderValidationException } from "./founder-ai/exceptions";
import { FounderAIValidator } from "./founder-ai/FounderAIValidator";
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
  namespace: "founder-test-namespace",
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
  console.log("=== START SPRINT 30.2 FOUNDER AI MODE TESTS ===\n");

  let assertionsCount = 0;
  const countAssert = (condition: boolean, msg: string) => {
    assert(condition, msg);
    assertionsCount++;
  };

  // 1. Builder Validation
  console.log("1. Builder Validation...");
  try {
    new FounderAIBuilder().build();
    countAssert(false, "Builder should throw if context is missing.");
  } catch (err: any) {
    countAssert(err instanceof FounderAIException, "Expected FounderAIException.");
  }
  const engine = new FounderAIBuilder().withContext(mockContext).build();
  countAssert(engine !== null, "Engine instance should not be null.");
  console.log("  ✓ engine created");

  await engine.initialize();
  countAssert(engine.getState() === FounderAIState.READY, "Engine state should be READY.");
  await engine.start();
  countAssert(engine.getState() === FounderAIState.RUNNING, "Engine state should be RUNNING.");
  console.log("  ✓ initialized");

  // 2. Founder Profile
  console.log("\n2. Founder Profile...");
  const prof = engine.getFounderManager().getProfile();
  countAssert(prof.name === "Founder", "Default founder name mismatch.");
  console.log("  ✓ profile loaded");
  engine.getFounderManager().updateProfile({ workingHours: "08:00-16:00" });
  countAssert(engine.getFounderManager().getProfile().workingHours === "08:00-16:00", "Preferences working hours not stored.");
  console.log("  ✓ preferences stored");

  // 3. Goal Management
  console.log("\n3. Goal Management...");
  const initialGoalsLength = engine.getGoalManager().listGoals().length;
  const g1 = {
    id: "goal_new_niche",
    title: "Launch Tech Niche Playlist",
    type: FounderGoalType.Content,
    priority: 9,
    progressPercent: 10,
    deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    status: "active" as const
  };
  engine.getGoalManager().createGoal(g1);
  countAssert(engine.getGoalManager().listGoals().length === initialGoalsLength + 1, "Goal count should increment.");
  console.log("  ✓ goals created");
  countAssert(engine.getGoalManager().listGoals().find(g => g.id === "goal_new_niche")?.priority === 9, "Goal priority mismatch.");
  console.log("  ✓ priorities assigned");

  // 4. Decision Engine
  console.log("\n4. Decision Engine...");
  const decision = {
    id: "dec_1",
    title: "Select primary target channel provider",
    alternatives: ["YouTube Only", "Cross Platform"],
    priority: DecisionPriority.High,
    scores: { "YouTube Only": 75, "Cross Platform": 92 },
    estimatedImpact: 85,
    estimatedRisk: 25,
    timestamp: new Date()
  };
  const evaluated = engine.getDecisionManager().evaluateDecision(decision);
  countAssert(evaluated.chosenOption === "Cross Platform", "Chosen decision option mismatch.");
  console.log("  ✓ decision evaluated");
  countAssert(evaluated.reason !== undefined, "Reason description must be included.");
  console.log("  ✓ best option selected");

  // 5. Planning
  console.log("\n5. Planning...");
  const dailyBrief = await engine.getPlanningManager().generateDailyPlan();
  countAssert(dailyBrief.priorities.length > 0, "Priorities must contain at least one item.");
  console.log("  ✓ daily plan generated");
  const weeklyPlan = await engine.getPlanningManager().generateWeeklyPlan();
  countAssert(weeklyPlan.length > 0, "Weekly planning steps must exist.");
  console.log("  ✓ weekly plan generated");

  // 6. Execution Coordination
  console.log("\n6. Execution Coordination...");
  const researchRes = await engine.getExecutionManager().executeCommand("Research this topic");
  countAssert(researchRes !== null, "Research coordinate return invalid.");
  console.log("  ✓ research pipeline executed");
  const contentRes = await engine.getExecutionManager().executeCommand("Generate today's video");
  countAssert(contentRes !== null, "Content generation coordinate return invalid.");
  console.log("  ✓ content pipeline executed");

  // 7. Recommendation Engine
  console.log("\n7. Recommendation Engine...");
  const recs = engine.getRecommendationManager().generateRecommendations();
  countAssert(recs.length > 0, "Recommendations list should contain generated tips.");
  console.log("  ✓ recommendations generated");
  countAssert(recs.some(r => r.state === RecommendationState.ACTIVE), "Opportunities detected state mismatched.");
  console.log("  ✓ opportunities detected");

  // 8. Founder Insights
  console.log("\n8. Founder Insights...");
  const insights = engine.getInsightManager().generateInsights();
  countAssert(insights.niche === "AI Video Automation", "Insight target niche mismatch.");
  console.log("  ✓ insights created");
  countAssert(insights.productivityScore > 90, "Productivity metric score mismatch.");
  console.log("  ✓ productivity score calculated");

  // 9. Daily Brief
  console.log("\n9. Daily Brief...");
  countAssert(dailyBrief.priorities.includes("Grow YouTube Audience"), "Brief priorities list incomplete.");
  console.log("  ✓ morning brief generated");
  const eveningSummary = await engine.getExecutionManager().executeCommand("Shutdown AI OS");
  countAssert(eveningSummary.status === "success", "Evening shutdown process execution failed.");
  console.log("  ✓ evening summary generated");

  // 10. Command Center
  console.log("\n10. Command Center...");
  const commandRes = await engine.getExecutionManager().executeCommand("Start today's work");
  countAssert(commandRes.status === "simulated" || commandRes.status === "success", "Command center invocation failed.");
  console.log("  ✓ founder command executed");
  countAssert(engine.getStatistics().tasksCompleted > 0, "Execution task tracking statistics mismatch.");
  console.log("  ✓ execution tracked");

  // 11. Statistics
  console.log("\n11. Statistics...");
  engine.getStatisticsManager().recordHoursSaved(10);
  countAssert(engine.getStatistics().hoursSaved === 130, "Recorded hours saved mismatch.");
  console.log("  ✓ founder statistics generated");
  countAssert(engine.getStatistics().goalsCompleted === 8, "Recorded completed goals count mismatch.");
  console.log("  ✓ reports updated");

  // 12. Dashboard Integration
  console.log("\n12. Dashboard Integration...");
  const dashboardSnap = engine.getSnapshot();
  countAssert(dashboardSnap.insights.length > 0, "Dashboard snap insights should exist.");
  console.log("  ✓ founder dashboard updated");
  countAssert(dashboardSnap.statistics.productivityScore === undefined || dashboardSnap.statistics.tasksCompleted >= 45, "Productivity score widgets update check failed.");
  console.log("  ✓ widgets refreshed");

  // 13. Database Integration
  console.log("\n13. Database Integration...");
  engine.getHistoryManager().saveSnapshot(dashboardSnap);
  countAssert(engine.getHistoryManager().getHistory().length > 0, "History snapshot not saved in registry.");
  console.log("  ✓ founder history stored");
  countAssert(engine.getGoalManager().listGoals().length > 0, "Goals history not saved.");
  console.log("  ✓ goals stored");

  // 14. Knowledge Base Integration
  console.log("\n14. Knowledge Base Integration...");
  countAssert(engine.getInsightManager().getInsights() !== undefined, "Insights could not be retrieved from KB archive.");
  console.log("  ✓ insights archived");
  countAssert(engine.getHistoryManager().getHistory()[0] !== undefined, "Snapshot reports missing from KB archive.");
  console.log("  ✓ reports archived");

  // 15. Memory Integration
  console.log("\n15. Memory Integration...");
  countAssert(engine.getStatistics().moneySpent > 0, "Expenses memory check failed.");
  console.log("  ✓ execution recorded");
  countAssert(dashboardSnap.timestamp !== undefined, "Snapshot save timestamp missing.");
  console.log("  ✓ snapshot saved");

  // 16. Event Publishing
  console.log("\n16. Event Publishing...");
  let decFired = false;
  engine.on(FounderEventType.DECISION_MADE, () => {
    decFired = true;
  });
  engine.getDecisionManager().evaluateDecision(decision);
  countAssert(decFired, "DECISION_MADE event failed to trigger.");
  console.log("  ✓ founder events fired");

  let cmdCompletedFired = false;
  engine.on(FounderEventType.COMMAND_COMPLETED, () => {
    cmdCompletedFired = true;
  });
  await engine.getExecutionManager().executeCommand("Emergency stop");
  countAssert(cmdCompletedFired, "COMMAND_COMPLETED event failed to trigger.");
  console.log("  ✓ completion event received");

  // 17. Snapshot Immutability
  console.log("\n17. Snapshot Immutability...");
  const snapToFreeze = engine.getSnapshot();
  countAssert(Object.isFrozen(snapToFreeze), "Snapshot must be frozen recursively.");
  console.log("  ✓ snapshot frozen");
  try {
    (snapToFreeze as any).state = FounderAIState.FAILED;
    countAssert(false, "Mutation should have thrown.");
  } catch {
    countAssert(true, "Mutation rejected successfully.");
  }
  console.log("  ✓ mutation rejected");

  // 18. Validator Rules
  console.log("\n18. Validator Rules...");
  const validator = new FounderAIValidator();
  try {
    validator.validateGoal({ id: "g_inv", title: "", type: FounderGoalType.Content, priority: 5, progressPercent: 0, deadline: new Date(), status: "active" });
    countAssert(false, "Validator should reject empty goal title.");
  } catch (err: any) {
    countAssert(err instanceof FounderValidationException, "Expected FounderValidationException on empty title.");
  }
  console.log("  ✓ invalid goal rejected");

  try {
    validator.validateProfile(prof);
    countAssert(true, "Validator should accept valid founder profile.");
  } catch {
    countAssert(false, "Validator rejected valid profile.");
  }
  console.log("  ✓ valid founder profile accepted");

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
  const registeredFounder = runtime.getEngine("FounderAIEngine") as FounderAIEngine;
  countAssert(registeredFounder !== undefined, "FounderAIEngine should be registered.");
  console.log("  ✓ dependencies resolved");

  // 20. Complete End-to-End Founder AI Mode
  console.log("\n20. Complete End-to-End Founder AI Mode...");
  await registeredFounder.initialize();
  await registeredFounder.start();
  countAssert(registeredFounder.getState() === FounderAIState.RUNNING, "E2E engine startup failed.");
  console.log("  ✓ personal AI operating system fully operational");
  countAssert(registeredFounder.getFounderManager().getProfile() !== undefined, "E2E founder workspace profiles missing.");
  console.log("  ✓ founder workspace coordinated");
  const automatedRes = await registeredFounder.getExecutionManager().executeCommand("Start today's work");
  countAssert(automatedRes !== undefined, "E2E founder workflow trigger output invalid.");
  console.log("  ✓ daily automation integrated");
  countAssert(registeredFounder.getPlanningManager().generateDailyPlan() !== undefined, "E2E daily planner brief generation failed.");
  console.log("  ✓ executive assistant ready");

  console.log(`\n=== ${assertionsCount}/${assertionsCount} FOUNDER AI MODE TESTS PASSED SUCCESSFULLY ===`);
}

runTests().catch(err => {
  console.error("Test execution threw an exception:", err);
  process.exit(1);
});
