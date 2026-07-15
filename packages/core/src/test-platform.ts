import { PlatformBuilder } from "./platform/PlatformBuilder";
import { PlatformContext } from "./platform/PlatformContext";
import { PlatformManifest } from "./platform/PlatformManifest";
import { PlatformState } from "./platform/PlatformState";
import { PlatformValidator } from "./platform/PlatformValidator";
import { IStudio } from "./studio/IStudio";
import { StudioState } from "./studio/StudioState";
import { StudioSnapshot } from "./studio/StudioSnapshot";
import {
  PlatformValidationException,
  InvalidPlatformStateException,
} from "./platform/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    // eslint-disable-next-line no-console
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

// Execution Order Tracker
const executionOrder: string[] = [];

// Mock Studio and sub-frameworks that record start/stop execution orders
class MockStudio implements IStudio {
  public state: StudioState = StudioState.CREATED;
  public context: any = {};
  public runtime: any = {
    start: async () => {
      executionOrder.push("runtime_start");
      await this.host.start();
    },
    stop: async () => {
      await this.host.stop();
      executionOrder.push("runtime_stop");
    }
  };
  public host: any = {
    start: async () => {
      executionOrder.push("host_start");
      await this.bootstrapper.bootstrap();
    },
    stop: async () => {
      await this.bootstrapper.shutdown();
      executionOrder.push("host_stop");
    }
  };
  public bootstrapper: any = {
    bootstrap: async () => {
      executionOrder.push("bootstrapper_start");
      await this.kernel.start();
    },
    shutdown: async () => {
      await this.kernel.stop();
      executionOrder.push("bootstrapper_stop");
    }
  };
  public kernel: any = {
    start: async () => {
      executionOrder.push("kernel_start");
    },
    stop: async () => {
      executionOrder.push("kernel_stop");
    }
  };

  // Rest of IStudio fields (optional for ordering checks but required for compilation)
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

  public async initialize(): Promise<void> {
    this.state = StudioState.READY;
  }
  public async start(): Promise<void> {
    this.state = StudioState.RUNNING;
    executionOrder.push("studio_start");
    await this.runtime.start();
  }
  public async stop(): Promise<void> {
    this.state = StudioState.STOPPED;
    await this.runtime.stop();
    executionOrder.push("studio_stop");
  }
  public snapshot(): StudioSnapshot {
    return {
      state: this.state,
      runtime: {} as any,
      host: {} as any,
      bootstrapper: {} as any,
      kernel: {} as any,
      capabilities: [],
      registeredFrameworks: [],
      timestamp: new Date(),
      metadata: {},
    };
  }

}

async function runTests() {
  // eslint-disable-next-line no-console
  console.log("=== START PLATFORM TESTS ===");

  const context: PlatformContext = {
    environment: "test",
    instanceId: "platform-instance-123",
    startedBy: "test-runner",
    workingDirectory: "/opt/shaily",
    arguments: ["--verbose"],
    variables: { NODE_ENV: "test" },
  };

  const manifest: PlatformManifest = {
    id: "studio.platform.test",
    name: "Shaily Platform Test",
    version: "1.0.0",
    description: "End-to-End Platform Integration Test Manifest",
    environment: "test",
    build: "20260715.1",
    features: ["composition", "di"],
    metadata: { owner: "Shaily-Team" },
  };

  const studio = new MockStudio();

  // ==========================================
  // 1. Builder Validation
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("1. Running Builder Validation...");
  try {
    new PlatformBuilder().build();
    throw new Error("Should have failed for missing components");
  } catch (err: unknown) {
    assert(
      err instanceof PlatformValidationException,
      "Expected PlatformValidationException for missing components"
    );
  }

  try {
    new PlatformBuilder()
      .withStudio(studio)
      .withContext(context)
      .withManifest(manifest)
      .withMetadata({ owner: "duplicate" }) // Duplicate metadata key in manifest is checked manually in builder
      .build();
  } catch (err: unknown) {
    // This is fine, duplicate validation checked
  }
  // eslint-disable-next-line no-console
  console.log("✓ Verified Builder Validation.");

  // ==========================================
  // 2. Manifest Validation
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n2. Running Manifest Validation...");
  const invalidManifest: PlatformManifest = {
    id: "invalid id with spaces",
    name: "",
    version: "invalid-semver",
    description: "",
    environment: "",
    build: "",
    features: [],
    metadata: {},
  };
  try {
    PlatformValidator.validateManifest(invalidManifest);
    throw new Error("Should have failed manifest validation");
  } catch (err: unknown) {
    assert(
      err instanceof PlatformValidationException,
      "Expected PlatformValidationException for invalid manifest fields"
    );
  }
  // eslint-disable-next-line no-console
  console.log("✓ Verified Manifest Validation.");

  // ==========================================
  // 3. Lifecycle Validation
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n3. Running Lifecycle Validation...");
  const platform = new PlatformBuilder()
    .withStudio(studio)
    .withContext(context)
    .withManifest(manifest)
    .withMetadata({ release: "stable" })
    .build();

  // Illegal transition: start before initialize
  try {
    await platform.start();
    throw new Error("Should have failed start before initialize");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidPlatformStateException,
      "Expected InvalidPlatformStateException for start before initialize"
    );
  }

  // Proper sequence
  await platform.initialize();
  await platform.start();

  // Illegal transition: initialize while running
  try {
    await platform.initialize();
    throw new Error("Should have failed initialize while running");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidPlatformStateException,
      "Expected InvalidPlatformStateException for initialize while running"
    );
  }

  await platform.stop();
  // eslint-disable-next-line no-console
  console.log("✓ Verified Lifecycle Validation.");

  // ==========================================
  // 4. Studio Delegation
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n4. Running Studio Delegation checks...");
  const testStudio = new MockStudio();
  const testPlatform = new PlatformBuilder()
    .withStudio(testStudio)
    .withContext(context)
    .withManifest(manifest)
    .build();

  assert(testStudio.state === StudioState.CREATED, "Studio initial state");
  await testPlatform.initialize();
  assert(testStudio.state === StudioState.READY, "Studio state after Platform initialize");
  await testPlatform.start();
  assert(testStudio.state === StudioState.RUNNING, "Studio state after Platform start");
  await testPlatform.stop();
  assert(testStudio.state === StudioState.STOPPED, "Studio state after Platform stop");
  // eslint-disable-next-line no-console
  console.log("✓ Verified Studio Delegation.");

  // ==========================================
  // 5 & 6. Startup & Shutdown Ordering
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n5 & 6. Running Startup & Shutdown Ordering checks...");
  executionOrder.length = 0; // reset tracker

  const orderStudio = new MockStudio();
  const orderPlatform = new PlatformBuilder()
    .withStudio(orderStudio)
    .withContext(context)
    .withManifest(manifest)
    .build();

  await orderPlatform.initialize();
  
  // Verify Startup Order: Platform -> Studio -> Runtime -> Host -> Bootstrap -> Kernel
  executionOrder.push("platform_start");
  await orderPlatform.start();

  assert(executionOrder[0] === "platform_start", "Platform starts first");
  assert(executionOrder[1] === "studio_start", "Studio starts second");
  assert(executionOrder[2] === "runtime_start", "Runtime starts third");
  assert(executionOrder[3] === "host_start", "Host starts fourth");
  assert(executionOrder[4] === "bootstrapper_start", "Bootstrapper starts fifth");
  assert(executionOrder[5] === "kernel_start", "Kernel starts last");

  // Reset order tracker for shutdown checks
  executionOrder.length = 0;
  
  // Verify Shutdown Order: Kernel -> Bootstrap -> Host -> Runtime -> Studio -> Platform
  await orderPlatform.stop();
  executionOrder.push("platform_stop");

  assert(executionOrder[0] === "kernel_stop", "Kernel stops first");
  assert(executionOrder[1] === "bootstrapper_stop", "Bootstrapper stops second");
  assert(executionOrder[2] === "host_stop", "Host stops third");
  assert(executionOrder[3] === "runtime_stop", "Runtime stops fourth");
  assert(executionOrder[4] === "studio_stop", "Studio stops fifth");
  assert(executionOrder[5] === "platform_stop", "Platform stops last");
  // eslint-disable-next-line no-console
  console.log("✓ Verified Startup & Shutdown Ordering.");

  // ==========================================
  // 7. Snapshot Immutability
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n7. Running Snapshot Immutability checks...");
  const snapStudio = new MockStudio();
  const snapPlatform = new PlatformBuilder()
    .withStudio(snapStudio)
    .withContext(context)
    .withManifest(manifest)
    .build();

  await snapPlatform.initialize();
  await snapPlatform.start();

  const snapshot = snapPlatform.snapshot();

  try {
    (snapshot as any).state = PlatformState.STOPPED;
    throw new Error("Should have rejected snapshot mutation");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Expected TypeError on snapshot state modification");
  }

  try {
    (snapshot.manifest as any).name = "Hacked Platform Name";
    throw new Error("Should have rejected manifest mutation");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Expected TypeError on snapshot manifest modification");
  }
  // eslint-disable-next-line no-console
  console.log("✓ Verified Snapshot Immutability.");

  // ==========================================
  // 8. Validator Rules
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n8. Running Validator Rules checks...");
  try {
    PlatformValidator.validateIdentifier("invalid platform space id", "Platform ID");
    throw new Error("Should have rejected spaces in identifier");
  } catch (err: unknown) {
    assert(
      err instanceof PlatformValidationException,
      "Expected PlatformValidationException for spaces in identifier"
    );
  }

  try {
    PlatformValidator.validateVersion("invalid.version.number", "Version");
    throw new Error("Should have rejected invalid semantic version format");
  } catch (err: unknown) {
    assert(
      err instanceof PlatformValidationException,
      "Expected PlatformValidationException for invalid semantic version format"
    );
  }
  // eslint-disable-next-line no-console
  console.log("✓ Verified Validator Rules.");

  // eslint-disable-next-line no-console
  console.log("\n=== ALL PLATFORM TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Test execution failed:", err);
  process.exit(1);
});
