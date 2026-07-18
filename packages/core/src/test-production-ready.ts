/**
 * Sprint 17.2 — Final Integration & Production Engine
 * Verification Suite — 20 Tests
 */

import { ProductionReadyEngine }    from "./production-ready/ProductionReadyEngine";
import { ProductionReadyBuilder }   from "./production-ready/ProductionReadyBuilder";
import { ProductionReadyValidator } from "./production-ready/ProductionReadyValidator";
import { ProductionState }          from "./production-ready/ProductionState";
import { ValidationState }          from "./production-ready/ValidationState";
import { BenchmarkState }           from "./production-ready/BenchmarkState";
import { StressState }              from "./production-ready/StressState";
import { CertificationLevel }       from "./production-ready/CertificationLevel";
import { ReleaseType }              from "./production-ready/ReleaseType";
import { DeploymentTarget }         from "./production-ready/DeploymentTarget";
import {
  ProductionValidationException,
  ProductionReadyException,
  ValidationException,
  BenchmarkException,
  CertificationException,
} from "./production-ready/types";
import type {
  ProductionRequest,
  ProductionResponse,
  IntegrationReport,
  ValidationReport,
  BenchmarkReport,
  StressTestReport,
  DeploymentProfile,
  CertificationReport,
  ReleasePackage,
  ProductionSnapshot,
} from "./production-ready/models";

// ─── Assertion Helper ─────────────────────────────────────────────────────────

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("❌ Assertion Failed:", message);
    process.exit(1);
  }
}

// ─── Mock Helpers ─────────────────────────────────────────────────────────────

function makeContext(overrides: Record<string, any> = {}): any {
  const events: any[] = [];
  const store = new Map<string, any>();
  return {
    logger: { info: () => {}, error: () => {}, warn: () => {} },
    eventBus: {
      publish: async (e: any) => { events.push(e); },
      _events: events,
    },
    memoryStore: {
      get: async (ns: string, key: string) => store.has(`${ns}:${key}`) ? { value: store.get(`${ns}:${key}`) } : undefined,
      set: async (ns: string, key: string, value: any) => { store.set(`${ns}:${key}`, value); },
      _store: store,
    },
    registry: { has: () => false, resolve: () => null },

    // Setup required engines for validation
    researchEngine:    { refresh: async () => {} },
    strategyEngine:    { refresh: async () => {} },
    channelEngine:     { refresh: async () => {} },
    scriptEngine:      { refresh: async () => {} },
    productionEngine:  { refresh: async () => {} },
    generationEngine:  { refresh: async () => {} },
    compositionEngine: { refresh: async () => {} },
    renderEngine:      { refresh: async () => {} },
    qualityEngine:     { refresh: async () => {} },
    publishingEngine:  { refresh: async () => {} },
    analyticsEngine:   { refresh: async () => {} },
    channelManager:    { refresh: async () => {} },
    founderEngine:     { refresh: async () => {} },
    controlCenterEngine: { refresh: async () => {} },
    learningEngine:    { refresh: async () => {} },
    optimizationEngine: { refresh: async () => {} },
    pipelineEngine:    { refresh: async () => {} },

    ...overrides,
  };
}

function makeProductionRequest(overrides: Partial<ProductionRequest> = {}): ProductionRequest {
  return {
    id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    releaseType: ReleaseType.RELEASE_CANDIDATE,
    target: DeploymentTarget.PRODUCTION,
    timestamp: new Date(),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function runTests(): Promise<void> {
  console.log("=== START SPRINT 17.2 FINAL INTEGRATION & PRODUCTION TESTS ===\n");

  // ==========================================================================
  // 1. Builder Validation
  // ==========================================================================
  console.log("1. Builder Validation...");
  try {
    new ProductionReadyBuilder().build();
    throw new Error("Expected ProductionValidationException");
  } catch (err: unknown) {
    assert(err instanceof ProductionValidationException, "Builder without context must throw ProductionValidationException");
  }
  const builder = new ProductionReadyBuilder().withContext(makeContext()).withMetadata({ sprint: "17.2" });
  const eng1 = builder.build();
  assert(eng1 instanceof ProductionReadyEngine, "Builder must construct ProductionReadyEngine");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 2. Lifecycle Transitions
  // ==========================================================================
  console.log("2. Lifecycle Transitions...");
  const eng2 = new ProductionReadyEngine(makeContext());
  assert(eng2.state === ProductionState.CREATED, "Initial state must be CREATED");
  await eng2.initialize();
  assert(eng2.state === ProductionState.INITIALIZED, "State must transition to INITIALIZED");
  await eng2.start();
  assert(eng2.state === ProductionState.RUNNING, "State must transition to RUNNING");
  await eng2.stop();
  assert(eng2.state === ProductionState.FAILED, "State must transition to FAILED");

  // Invalid state transition
  try {
    ProductionReadyValidator.validateStateTransition("test", ProductionState.CREATED, ProductionState.COMPLETED);
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof ProductionValidationException, "Invalid transition must fail validation");
  }
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 3. Integration Validation
  // ==========================================================================
  console.log("3. Integration Validation...");
  const eng3 = new ProductionReadyEngine(makeContext());
  const validator = eng3.getValidator();
  const report3 = await validator.validateIntegration(eng3.context);
  assert(report3.state === ValidationState.VALID, "Integration must be VALID for standard seeded context");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 4. Service Registry Validation
  // ==========================================================================
  console.log("4. Service Registry Validation...");
  // Test dependencies graph validation
  const validEdges: [string, string][] = [
    ["scriptEngine", "generationEngine"],
    ["generationEngine", "renderEngine"],
  ];
  ProductionReadyValidator.validateNoCircularServices(validEdges);

  // Circular check
  const circularEdges: [string, string][] = [
    ["scriptEngine", "generationEngine"],
    ["generationEngine", "scriptEngine"],
  ];
  try {
    ProductionReadyValidator.validateNoCircularServices(circularEdges);
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof ProductionValidationException, "Circular dependencies must fail validation");
  }
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 5. Context Validation
  // ==========================================================================
  console.log("5. Context Validation...");
  const eng5 = new ProductionReadyEngine(makeContext());
  ProductionReadyValidator.validateEngineRegistrations(eng5.context);
  
  try {
    ProductionReadyValidator.validateEngineRegistrations({});
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof ProductionValidationException, "Empty context validation must fail");
  }
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 6. Memory Namespace Validation
  // ==========================================================================
  console.log("6. Memory Namespace Validation...");
  const namespaces = ["production-ready", "integration-report", "stress-report"];
  ProductionReadyValidator.validateMemoryNamespaces(namespaces);

  try {
    ProductionReadyValidator.validateMemoryNamespaces(["duplicate-ns", "duplicate-ns"]);
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof ProductionValidationException, "Duplicate namespaces must fail validation");
  }
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 7. Event Bus Validation
  // ==========================================================================
  console.log("7. Event Bus Validation...");
  const events = ["ProductionValidationStarted", "IntegrationValidated"];
  ProductionReadyValidator.validateEventRegistrations(events);

  try {
    ProductionReadyValidator.validateEventRegistrations(["dup-event", "dup-event"]);
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof ProductionValidationException, "Duplicate event registrations must fail");
  }
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 8. Performance Benchmark
  // ==========================================================================
  console.log("8. Performance Benchmark...");
  const eng8 = new ProductionReadyEngine(makeContext());
  const runner = eng8.getBenchmarkRunner();
  const benchmarkReport = await runner.runBenchmarks(eng8.context);
  assert(benchmarkReport.state === BenchmarkState.COMPLETED, "Benchmark run should succeed");
  assert(benchmarkReport.metrics.startupTimeMs <= 5000, "Benchmark metrics values populated");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 9. Stress Testing
  // ==========================================================================
  console.log("9. Stress Testing...");
  const eng9 = new ProductionReadyEngine(makeContext());
  const tester = eng9.getStressTester();
  const stressReport = await tester.runStressTests(eng9.context);
  assert(stressReport.state === StressState.COMPLETED, "Stress test run should succeed");
  assert(stressReport.totalExecutionsAttempted === 1000, "Stress executions size matches spec");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 10. Regression Testing
  // ==========================================================================
  console.log("10. Regression Testing...");
  // Verifying that Sprint 17.1 PipelineEngine still operates properly
  const pipelineCtx = makeContext();
  const pe = new (require("./pipeline/PipelineEngine").PipelineEngine)(pipelineCtx);
  await pe.initialize();
  await pe.start();
  const pRequest = {
    id: "req-regression", goal: "Faceless YT Channel", mode: 0 as any, strategy: 0 as any, priority: 0 as any,
    stages: [require("./pipeline/PipelineStage").PipelineStage.RESEARCH], timestamp: new Date(),
  };
  const peResp = await pe.execute(pRequest);
  assert(peResp.result === require("./pipeline/PipelineResult").PipelineResult.SUCCESS, "PipelineEngine must execute properly (regression test)");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 11. Documentation Generation
  // ==========================================================================
  console.log("11. Documentation Generation...");
  const eng11 = new ProductionReadyEngine(makeContext());
  const docGen = eng11.getDocGenerator();
  const docSuccess = await docGen.generateDocs(eng11.context);
  assert(docSuccess, "Documentation generation must complete with success true");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 12. Release Packaging
  // ==========================================================================
  console.log("12. Release Packaging...");
  const eng12 = new ProductionReadyEngine(makeContext());
  const packager = eng12.getPackager();
  const releasePkg = await packager.createPackage(makeProductionRequest({ releaseType: ReleaseType.PATCH }));
  assert(releasePkg.releaseType === ReleaseType.PATCH, "Release package type matches metadata");
  assert(releasePkg.archivePath.endsWith(".zip"), "Release ZIP package path registered");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 13. Certification Engine
  // ==========================================================================
  console.log("13. Certification Engine...");
  const eng13 = new ProductionReadyEngine(makeContext());
  const certEng = eng13.getCertificationEngine();
  const certReport = await certEng.grantCertification(CertificationLevel.PRODUCTION_CERTIFIED);
  assert(certReport.level === CertificationLevel.PRODUCTION_CERTIFIED, "Level matches PRODUCTION_CERTIFIED");
  assert(certReport.auditTrail.length > 0, "Audit trail generated");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 14. Memory Integration
  // ==========================================================================
  console.log("14. Memory Integration...");
  const ctx14 = makeContext();
  const eng14 = new ProductionReadyEngine(ctx14);
  await eng14.initialize();
  await eng14.start();
  await eng14.certify(makeProductionRequest({ id: "req-mem-01" }));

  const memStore = ctx14.memoryStore._store as Map<string, any>;
  assert(memStore.has("production-ready:state:req-mem-01"), "Must write state value to memory");
  assert(memStore.has("integration-report:int:req-mem-01"), "Must write integration report ID to memory");
  assert(memStore.has("benchmark-report:bench:req-mem-01"), "Must write benchmark report ID to memory");
  assert(memStore.has("stress-report:stress:req-mem-01"), "Must write stress report ID to memory");
  assert(memStore.has("release-history:release:req-mem-01"), "Must write release ZIP archive path to memory");
  assert(memStore.has("certification-history:cert:req-mem-01"), "Must write certification level history to memory");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 15. Decision Integration
  // ==========================================================================
  console.log("15. Decision Integration...");
  let decisionRecorded = false;
  const ctx15 = makeContext({
    decisionEngine: {
      record: async (data: any) => {
        decisionRecorded = true;
        assert(data.productionReadyRequestId === "req-dec-01", "Decision record must contain request ID");
        assert(data.level === CertificationLevel.PRODUCTION_CERTIFIED, "Decision record must log certified level");
        assert(data.certified === true, "Decision record must confirm certified state");
      },
    },
  });
  const eng15 = new ProductionReadyEngine(ctx15);
  await eng15.initialize();
  await eng15.start();
  await eng15.certify(makeProductionRequest({ id: "req-dec-01", target: DeploymentTarget.PRODUCTION }));
  assert(decisionRecorded, "Decision record must be logged after certification cycle completes");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 16. Agent Integration
  // ==========================================================================
  console.log("16. Agent Integration...");
  const eng16 = new ProductionReadyEngine(makeContext());
  assert(typeof eng16.getValidator           === "function", "Sub-system Validator exists");
  assert(typeof eng16.getBenchmarkRunner     === "function", "Sub-system BenchmarkRunner exists");
  assert(typeof eng16.getStressTester        === "function", "Sub-system StressTester exists");
  assert(typeof eng16.getDocGenerator        === "function", "Sub-system DocGenerator exists");
  assert(typeof eng16.getCertificationEngine === "function", "Sub-system CertificationEngine exists");
  assert(typeof eng16.getPackager            === "function", "Sub-system Packager exists");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 17. Snapshot Immutability
  // ==========================================================================
  console.log("17. Snapshot Immutability...");
  const eng17 = new ProductionReadyEngine(makeContext());
  await eng17.initialize();
  const snap17 = eng17.getSnapshot();
  assert(Object.isFrozen(snap17), "ProductionSnapshot root must be frozen");

  let mutationFailed = false;
  try { (snap17 as any).id = "mutated"; } catch (_) { mutationFailed = true; }
  assert(snap17.id !== "mutated" || mutationFailed, "Snapshot ID must be immutable");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 18. Validator Rules
  // ==========================================================================
  console.log("18. Validator Rules...");

  // 18a. Duplicate exports list
  try {
    ProductionReadyValidator.validateNoDuplicateExports(["researchModule", "researchModule"]);
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof ProductionValidationException, "Duplicate exports must fail validation");
  }

  // 18b. Startup benchmark delay
  try {
    const badReport: BenchmarkReport = {
      id: "bad", state: BenchmarkState.COMPLETED,
      metrics: { startupTimeMs: 12000, avgPipelineLatencyMs: 0, avgRoutingLatencyMs: 0, avgMemoryUsageMb: 0, avgCpuUsagePercent: 0, avgGpuUsagePercent: 0, eventBusThroughputPerSec: 0 },
      timestamp: new Date(),
    };
    ProductionReadyValidator.validatePerformanceThresholds(badReport);
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof ProductionValidationException, "Large startup delay must fail performance thresholds validation");
  }

  // 18c. Circular service dependencies validation
  try {
    ProductionReadyValidator.validateNoCircularServices([["a", "b"], ["b", "c"], ["c", "a"]]);
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof ProductionValidationException, "Circular services dependencies must fail validation");
  }

  // 18d. Missing connected engines in context validation
  try {
    ProductionReadyValidator.validateEngineRegistrations({});
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof ProductionValidationException, "Context without registered engines must fail validation");
  }

  console.log("✓ Passed.\n");

  // ==========================================================================
  // 19. Full End-to-End Production Validation
  // ==========================================================================
  console.log("19. Full End-to-End Production Validation...");
  const eng19 = new ProductionReadyEngine(makeContext());
  await eng19.initialize();
  await eng19.start();

  const req19 = makeProductionRequest({ id: "req-e2e-19", target: DeploymentTarget.STAGING });
  const resp19 = await eng19.certify(req19);

  assert(resp19.state === ProductionState.COMPLETED, "E2E: Engine must reach COMPLETED state");
  assert(resp19.certified === true, "E2E: Engine must grant certification");
  assert(resp19.level === CertificationLevel.RELEASE_CANDIDATE, "E2E: Target staging must grant RELEASE_CANDIDATE level");

  assert(eng19.getIntegrationReport() !== undefined, "E2E: Integration report compiled");
  assert(eng19.getBenchmarkReport() !== undefined, "E2E: Benchmark report compiled");
  assert(eng19.getStressReport() !== undefined, "E2E: Stress report compiled");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 20. Production Certification
  // ==========================================================================
  console.log("20. Production Certification...");
  const eng20 = new ProductionReadyEngine(makeContext());
  await eng20.initialize();
  await eng20.start();

  const req20 = makeProductionRequest({ id: "req-e2e-20", target: DeploymentTarget.PRODUCTION });
  const resp20 = await eng20.certify(req20);

  assert(resp20.certified === true, "E2E: Production certification must be successfully granted");
  assert(resp20.level === CertificationLevel.PRODUCTION_CERTIFIED, "E2E: Target production must grant PRODUCTION_CERTIFIED level");

  // Event validation
  const evts = (eng20.context.eventBus._events as any[]).map(e => e.name);
  assert(evts.includes("ProductionValidationStarted"), "E2E: ProductionValidationStarted published");
  assert(evts.includes("IntegrationValidated"), "E2E: IntegrationValidated published");
  assert(evts.includes("BenchmarkCompleted"), "E2E: BenchmarkCompleted published");
  assert(evts.includes("StressTestCompleted"), "E2E: StressTestCompleted published");
  assert(evts.includes("ReleasePackaged"), "E2E: ReleasePackaged published");
  assert(evts.includes("CertificationGranted"), "E2E: CertificationGranted published");
  assert(evts.includes("ProductionReadyCompleted"), "E2E: ProductionReadyCompleted published");

  console.log("✓ Passed.\n");

  console.log("=== ALL 20/20 FINAL INTEGRATION & PRODUCTION TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch(err => {
  console.error("Test suite execution failed:", err);
  process.exit(1);
});
