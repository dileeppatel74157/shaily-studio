import { StabilityPerformanceBuilder } from "./stability-performance/StabilityPerformanceBuilder";
import { StabilityState } from "./stability-performance/StabilityState";
import { TestState } from "./stability-performance/TestState";
import { StressState } from "./stability-performance/StressState";
import { PerformanceState } from "./stability-performance/PerformanceState";
import { MemoryHealth } from "./stability-performance/MemoryHealth";
import { CrashRecoveryState } from "./stability-performance/CrashRecoveryState";
import { OptimizationState } from "./stability-performance/OptimizationState";
import { CertificationState } from "./stability-performance/CertificationState";
import { StabilityValidationException, InvalidStabilityStateException } from "./stability-performance/types";
import { StabilityValidator } from "./stability-performance/StabilityValidator";
import { RuntimeBuilder } from "./runtime/RuntimeBuilder";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("❌ Assertion Failed:", message);
    process.exit(1);
  }
}

// Mock context
const mockEvents: any[] = [];
const mockContext = {
  logger: {
    info: (msg: string) => {},
    warn: (msg: string) => {},
    error: (msg: string) => {}
  },
  eventBus: {
    publish: async (event: any) => {
      mockEvents.push(event);
    }
  }
};

async function runTests() {
  console.log("=== START SPRINT 22.2 STABILITY & PERFORMANCE TESTS ===\n");

  // 1. Builder Validation
  try {
    new StabilityPerformanceBuilder().build();
    assert(false, "Builder should throw if context is missing.");
  } catch (err: any) {
    assert(err instanceof StabilityValidationException, "Expected StabilityValidationException.");
  }
  console.log("1. Builder Validation... ✓");

  // 2. Unit Test Runner
  const engine = new StabilityPerformanceBuilder().withContext(mockContext).build();
  assert(engine.getState() === StabilityState.CREATED, "Engine state should be CREATED.");
  
  await engine.initialize();
  assert(engine.getState() === StabilityState.READY, "Engine state should be READY.");
  
  const unitResults = await engine.getTestRunner().runUnitTests();
  assert(unitResults.length > 0 && unitResults[0].status === TestState.PASSED, "Unit tests runner failed.");
  console.log("2. Unit Test Runner... ✓");

  // 3. Integration Test Runner
  const intResults = await engine.getTestRunner().runIntegrationTests();
  assert(intResults.length > 0 && intResults[0].status === TestState.PASSED, "Integration tests runner failed.");
  console.log("3. Integration Test Runner... ✓");

  // 4. End-to-End Pipeline Test
  const e2eResults = await engine.getTestRunner().runEndToEndTests();
  assert(e2eResults.length > 0 && e2eResults[0].status === TestState.PASSED, "E2E tests runner failed.");
  console.log("4. End-to-End Pipeline Test... ✓");

  // 5. Stress Testing
  const stressReport = await engine.getStressTester().executeStressTest({
    id: "stress-test-01",
    name: "Concurrent pressure simulator",
    concurrentCommands: 100,
    scheduledTasks: 1000,
    durationMs: 500
  });
  assert(stressReport.status === StressState.PASSED, "Stress test was not marked PASSED.");
  assert(engine.getStressTester().getStressReports().length > 0, "Stress report was not saved.");
  console.log("5. Stress Testing... ✓");

  // 6. Performance Profiling
  const profile = await engine.getProfiler().profilePerformance();
  assert(profile.overallRating === PerformanceState.EXCELLENT, "Performance rating mismatch.");
  assert(profile.metrics.startupTimeMs === 850, "Startup boot latency mismatch.");
  console.log("6. Performance Profiling... ✓");

  // 7. Memory Analysis
  const memReport = await engine.getMemoryAnalyzer().analyzeMemory();
  assert(memReport.health === MemoryHealth.HEALTHY, "Memory analyzer health rating mismatch.");
  assert(memReport.snapshots.length > 0, "Memory snapshots list is empty.");
  console.log("7. Memory Analysis... ✓");

  // 8. Memory Leak Detection
  const leakSuspected = await engine.getMemoryAnalyzer().detectMemoryLeaks();
  assert(!leakSuspected, "Potential leak detected falsely.");
  console.log("8. Memory Leak Detection... ✓");

  // 9. Crash Recovery
  const crashReport = await engine.getRecoveryManager().simulateCrash({
    targetEngineId: "WorkspaceEngine",
    triggerType: "uncaught_exception",
    autoRecover: true
  });
  assert(crashReport.state === CrashRecoveryState.RECOVERED, "Recovery state not RECOVERED.");
  assert(engine.getRecoveryManager().getRecoveryReports().length > 1, "Recovery reports list mismatch.");
  console.log("9. Crash Recovery... ✓");

  // 10. Startup Optimization
  const startupProfile = await engine.getStartupOptimizer().optimizeStartup();
  assert(startupProfile.parallelBootTimeMs === 420, "Parallel startup latency mismatch.");
  console.log("10. Startup Optimization... ✓");

  // 11. Shutdown Optimization
  const shutdownProfile = await engine.getShutdownOptimizer().optimizeShutdown();
  assert(shutdownProfile.gracefulStop, "Graceful stop flag is false.");
  console.log("11. Shutdown Optimization... ✓");

  // 12. Runtime Validation
  // Setup runtime builder and check stabilityPerformanceEngine registration
  const runtimeContext = {
    env: "test",
    namespace: "runtime-stability-test",
    startTime: Date.now()
  };
  const runtimeConfig = {
    env: "test",
    heartbeatIntervalMs: 500,
    healthCheckIntervalMs: 1000,
    startupTimeoutMs: 500,
    shutdownTimeoutMs: 500
  };
  const runtime = new RuntimeBuilder()
    .withContext(runtimeContext)
    .withConfig(runtimeConfig)
    .build();

  assert(runtime !== null, "RuntimeEngine builder failed.");
  const stabilitySvc = runtime.getEngine("StabilityPerformanceEngine");
  assert(stabilitySvc !== undefined, "StabilityPerformanceEngine must be registered inside RuntimeEngine.");
  
  // Initialize runtime to trigger system-integration discovery and registration
  await runtime.initialize();
  console.log("12. Runtime Validation... ✓");

  // 13. Workspace Validation
  // Checks registry has registered workspace details
  const registrations = runtime.getEngine("SystemIntegrationEngine").getRegistry().getRegistrations();
  assert(registrations.some((r: any) => r.id === "WorkspaceEngine"), "WorkspaceEngine registration check failed.");
  console.log("13. Workspace Validation... ✓");

  // 14. Knowledge Base Validation
  assert(registrations.some((r: any) => r.id === "KnowledgeBaseEngine"), "KnowledgeBaseEngine registration check failed.");
  console.log("14. Knowledge Base Validation... ✓");

  // 15. Documentation Generation
  const doc = await engine.getDocGenerator().generateDocumentation();
  assert(doc.apiCount === 145, "API catalog counts mismatch.");
  console.log("15. Documentation Generation... ✓");

  // 16. Certification Generation
  const cert = await engine.getCertificationManager().generateCertification();
  assert(cert.state === CertificationState.CERTIFIED, "OS Certification failed.");
  console.log("16. Certification Generation... ✓");

  // 17. Snapshot Immutability
  const snap = engine.getSnapshot();
  assert(Object.isFrozen(snap), "Snapshot should be frozen.");
  assert(Object.isFrozen(snap.configuration), "Snapshot configuration should be frozen.");
  console.log("17. Snapshot Immutability... ✓");

  // 18. Validator Rules
  const snapshotObj = engine.getSnapshot();
  const valResult = new StabilityValidator().validate(snapshotObj, profile, memReport, cert);
  assert(valResult.isValid, "Standard validation rules should pass.");

  const badProfile = JSON.parse(JSON.stringify(profile));
  badProfile.metrics.startupTimeMs = 6000; // threshold limit is 5000ms
  const badResult = new StabilityValidator().validate(snapshotObj, badProfile, memReport, cert);
  assert(!badResult.isValid, "Validator should catch startup latency exceptions.");
  console.log("18. Validator Rules... ✓");

  // 19. Final AI OS Audit
  const audit = await engine.getCertificationManager().runFinalAudit();
  assert(audit.complianceLevel === "LEVEL 5 (MAX STABILITY)", "Audit compliance rating mismatch.");
  console.log("19. Final AI OS Audit... ✓");

  // 20. Complete Personal AI Operating System Certification
  const reportObj = await engine.getReport();
  assert(reportObj.certification.state === CertificationState.CERTIFIED, "E2E Certification audit failed.");
  console.log("20. Complete Personal AI Operating System Certification... ✓\n");

  console.log("=== ALL 20/20 STABILITY & PERFORMANCE TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch(err => {
  console.error("Test suite threw an exception:", err);
  process.exit(1);
});
