import { ReadinessBuilder } from "./readiness/ReadinessBuilder";
import { ReadinessContext } from "./readiness/ReadinessContext";
import { ReadinessConfiguration } from "./readiness/ReadinessConfiguration";
import { ReadinessState } from "./readiness/ReadinessState";
import { ReadinessStatus } from "./readiness/ReadinessResult";
import { ReadinessReportStatus } from "./readiness/ReadinessReport";
import { ReadinessValidator } from "./readiness/ReadinessValidator";
import { IPlatform } from "./platform/IPlatform";
import { IStudio } from "./studio/IStudio";
import {
  ReadinessValidationException,
  InvalidReadinessStateException,
} from "./readiness/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    // eslint-disable-next-line no-console
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

// Simple Mock Studio and Platform for testing
class MockStudio implements IStudio {
  public runtime: any = {};
  public host: any = {};
  public bootstrapper: any = {};
  public kernel: any = {};
  public configuration: any = {};
  public security: any = {};
  public observability: any = {};
  public storage: any = {};
  public scheduler: any = {};
  public gateway: any = {};
  public mcp: any = {};
  public messageBus: any = {};
  public knowledgeBase: any = {};
  public promptRegistry: any = {};
  public rag: any = {};

  public async initialize(): Promise<void> {}
  public async start(): Promise<void> {}
  public async stop(): Promise<void> {}
  public snapshot(): any {
    return { state: "RUNNING" };
  }
}

class MockPlatform implements IPlatform {
  constructor(public readonly studio: IStudio) {}
  public async initialize(): Promise<void> {}
  public async start(): Promise<void> {}
  public async stop(): Promise<void> {}
  public snapshot(): any {
    return { state: "RUNNING" };
  }
}

async function runTests() {
  // eslint-disable-next-line no-console
  console.log("=== START READINESS TESTS ===");

  const studio = new MockStudio();
  const platform = new MockPlatform(studio);

  const context: ReadinessContext = {
    env: "test",
    namespace: "shaily.readiness",
    platform,
    metadata: { version: "1.0.0" },
  };

  const configuration: ReadinessConfiguration = {
    checks: ["check.platform", "check.studio"],
    settings: {},
  };

  // ==========================================
  // 1. Builder Validation
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("1. Running Builder Validation...");
  try {
    new ReadinessBuilder().build();
    throw new Error("Should have failed for missing platform/context/config");
  } catch (err: unknown) {
    assert(
      err instanceof ReadinessValidationException,
      "Expected ReadinessValidationException for missing components"
    );
  }
  // eslint-disable-next-line no-console
  console.log("✓ Verified Builder Validation.");

  // ==========================================
  // 2. Lifecycle Validation
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n2. Running Lifecycle Validation...");
  const readiness = new ReadinessBuilder()
    .withPlatform(platform)
    .withContext(context)
    .withConfiguration(configuration)
    .withMetadata({ checker: "ReadinessTester" })
    .build();

  // Illegal: run checks before initialize/start
  try {
    await readiness.runChecks();
    throw new Error("Should have rejected runChecks before start");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidReadinessStateException,
      "Expected InvalidReadinessStateException for early runChecks"
    );
  }

  // Proper sequence
  await readiness.initialize();
  await readiness.start();

  const report = await readiness.runChecks();
  assert(report !== null, "Report must be generated");

  await readiness.stop();
  // eslint-disable-next-line no-console
  console.log("✓ Verified Lifecycle Validation.");

  // ==========================================
  // 3 & 4. Platform and Framework Validation
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n3 & 4. Running Platform & Framework Validation checks...");
  const healthyReadiness = new ReadinessBuilder()
    .withPlatform(platform)
    .withContext(context)
    .withConfiguration(configuration)
    .build();

  await healthyReadiness.initialize();
  await healthyReadiness.start();
  const healthyReport = await healthyReadiness.runChecks();

  assert(healthyReport.overallStatus === ReadinessReportStatus.READY, "Expected READY status");
  assert(healthyReport.failed === 0, "No checks should fail");
  await healthyReadiness.stop();
  // eslint-disable-next-line no-console
  console.log("✓ Verified Platform & Framework Validation.");

  // ==========================================
  // 5. Dependency Validation (Simulate Missing Component)
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n5. Running Dependency Validation (Simulating Missing Kernel)...");
  const badStudio = new MockStudio();
  (badStudio as any).kernel = null; // Kernel is missing!
  const badPlatform = new MockPlatform(badStudio);

  const badContext: ReadinessContext = {
    ...context,
    platform: badPlatform,
  };

  const badReadiness = new ReadinessBuilder()
    .withPlatform(badPlatform)
    .withContext(badContext)
    .withConfiguration(configuration)
    .build();

  await badReadiness.initialize();
  await badReadiness.start();
  const badReport = await badReadiness.runChecks();

  assert(badReport.overallStatus === ReadinessReportStatus.NOT_READY, "Expected NOT_READY overallStatus");
  assert(badReport.failed > 0, "At least one check must fail");
  
  const kernelCheck = badReport.checks.find(c => c.id === "check.kernel");
  assert(kernelCheck !== undefined && kernelCheck.status === ReadinessStatus.FAIL, "Kernel check must fail");
  await badReadiness.stop();
  // eslint-disable-next-line no-console
  console.log("✓ Verified Dependency Validation.");

  // ==========================================
  // 6. Readiness Report Generation
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n6. Running Readiness Report Generation checks...");
  assert(healthyReport.totalChecks === 14, "Must execute exactly 14 checks");
  assert(healthyReport.passed === 14, "All checks passed in healthy platform");
  assert(healthyReport.duration >= 0, "Duration must be positive");
  assert(healthyReport.timestamp instanceof Date, "Timestamp must be defined");
  // eslint-disable-next-line no-console
  console.log("✓ Verified Report Generation.");

  // ==========================================
  // 7. Snapshot Immutability
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n7. Running Snapshot Immutability checks...");
  const snapReadiness = new ReadinessBuilder()
    .withPlatform(platform)
    .withContext(context)
    .withConfiguration(configuration)
    .build();

  await snapReadiness.initialize();
  await snapReadiness.start();
  await snapReadiness.runChecks();
  const snapshot = snapReadiness.snapshot();

  try {
    (snapshot as any).lifecycleState = ReadinessState.STOPPED;
    throw new Error("Should have rejected snapshot state mutation");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Expected TypeError on snapshot state modification");
  }

  try {
    (snapshot.latestReport as any).passed = 999;
    throw new Error("Should have rejected report mutation");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Expected TypeError on report modification");
  }
  await snapReadiness.stop();
  // eslint-disable-next-line no-console
  console.log("✓ Verified Snapshot Immutability.");

  // ==========================================
  // 8. Validator Rules
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n8. Running Validator Rules checks...");
  try {
    ReadinessValidator.validateIdentifier("invalid check space id", "Check ID");
    throw new Error("Should have rejected spaces in check ID");
  } catch (err: unknown) {
    assert(
      err instanceof ReadinessValidationException,
      "Expected ReadinessValidationException for spaces in check ID"
    );
  }
  // eslint-disable-next-line no-console
  console.log("✓ Verified Validator Rules.");

  // eslint-disable-next-line no-console
  console.log("\n=== ALL READINESS TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Test execution failed:", err);
  process.exit(1);
});
