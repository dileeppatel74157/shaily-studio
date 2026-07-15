import { KernelBuilder } from "./kernel/KernelBuilder";
import { KernelContext } from "./kernel/KernelContext";
import { KernelModule } from "./kernel/KernelModule";
import { KernelState } from "./kernel/KernelState";
import { KernelValidator } from "./kernel/KernelValidator";
import { DependencyResolver } from "./kernel/DependencyResolver";
import {
  KernelValidationException,
  InvalidKernelStateException,
  CircularDependencyException,
  MissingDependencyException,
} from "./kernel/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    // eslint-disable-next-line no-console
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

class TestModule implements KernelModule {
  public initialized = false;
  public started = false;
  public stopped = false;

  constructor(
    public readonly id: string,
    public readonly dependencies: readonly string[],
    private readonly tracker?: {
      initOrder: string[];
      startOrder: string[];
      stopOrder: string[];
    }
  ) {}

  public async initialize(): Promise<void> {
    this.initialized = true;
    if (this.tracker) {
      this.tracker.initOrder.push(this.id);
    }
  }

  public async start(): Promise<void> {
    this.started = true;
    if (this.tracker) {
      this.tracker.startOrder.push(this.id);
    }
  }

  public async stop(): Promise<void> {
    this.stopped = true;
    if (this.tracker) {
      this.tracker.stopOrder.push(this.id);
    }
  }
}

async function runTests() {
  // eslint-disable-next-line no-console
  console.log("=== START KERNEL INTEGRATION TESTS ===");

  const context: KernelContext = {
    env: "test",
    namespace: "studio-kernel",
    metadata: { version: "1.0.0" },
  };

  // ==========================================
  // 1. Builder Validation
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n1. Running Builder Validation...");
  const kernel = new KernelBuilder()
    .withContext(context)
    .withMetadata({ debug: true })
    .build();

  assert(kernel !== null, "Kernel must build successfully");

  try {
    new KernelBuilder().build();
    throw new Error("Should have rejected missing context");
  } catch (err: unknown) {
    assert(
      err instanceof KernelValidationException,
      "Expected KernelValidationException for missing context"
    );
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified Builder Validation.");

  // ==========================================
  // 2. Module Registration
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n2. Running Module Registration...");
  const activeKernel = new KernelBuilder().withContext(context).build();
  
  const modA = new TestModule("moduleA", []);
  await activeKernel.register(modA);

  assert(activeKernel.has("moduleA"), "Should register moduleA");
  assert(activeKernel.get("moduleA") === modA, "Get module returns correct reference");
  assert(activeKernel.list().length === 1, "List contains exactly 1 module");

  // Duplicate prevention
  try {
    await activeKernel.register(new TestModule("moduleA", []));
    throw new Error("Should have prevented duplicate module ID registration");
  } catch (err: unknown) {
    assert(
      err instanceof KernelValidationException,
      "Expected KernelValidationException for duplicate ID"
    );
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified registration, lookup, duplicates.");

  // ==========================================
  // 3. Dependency Resolution
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n3. Running Dependency Resolution...");
  // Set up: A -> B -> C (A depends on B, B depends on C)
  // Expected startup: C, B, A
  const tracker = { initOrder: [], startOrder: [], stopOrder: [] };
  const dKernel = new KernelBuilder().withContext(context).build();
  
  const mC = new TestModule("moduleC", [], tracker);
  const mB = new TestModule("moduleB", ["moduleC"], tracker);
  const mA = new TestModule("moduleA", ["moduleB"], tracker);

  await dKernel.register(mA);
  await dKernel.register(mB);
  await dKernel.register(mC);

  const { startupOrder, shutdownOrder } = DependencyResolver.resolve(dKernel.list());
  
  assert(startupOrder[0] === "moduleC", "First startup should be C");
  assert(startupOrder[1] === "moduleB", "Second startup should be B");
  assert(startupOrder[2] === "moduleA", "Third startup should be A");

  assert(shutdownOrder[0] === "moduleA", "First shutdown should be A");
  assert(shutdownOrder[1] === "moduleB", "Second shutdown should be B");
  assert(shutdownOrder[2] === "moduleC", "Third shutdown should be C");
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified dependency graph and topological ordering.");

  // ==========================================
  // 4. Circular Dependency Detection
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n4. Running Circular Dependency Detection...");
  // Circle: A -> B -> C -> A
  const circularModules = [
    new TestModule("A", ["B"]),
    new TestModule("B", ["C"]),
    new TestModule("C", ["A"]),
  ];

  try {
    DependencyResolver.resolve(circularModules);
    throw new Error("Should have detected circular dependency");
  } catch (err: unknown) {
    assert(
      err instanceof CircularDependencyException,
      "Expected CircularDependencyException for cycle"
    );
  }

  // Missing dependency check
  const missingDepModules = [
    new TestModule("A", ["nonExistent"]),
  ];

  try {
    DependencyResolver.resolve(missingDepModules);
    throw new Error("Should have detected missing dependency");
  } catch (err: unknown) {
    assert(
      err instanceof MissingDependencyException,
      "Expected MissingDependencyException"
    );
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified circular dependency prevention.");

  // ==========================================
  // 5. Lifecycle Validation
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n5. Running Lifecycle Validation...");
  const lifeKernel = new KernelBuilder().withContext(context).build();
  
  const m1 = new TestModule("m1", [], tracker);
  await lifeKernel.register(m1);

  // Illegal start before initialize
  try {
    await lifeKernel.start();
    throw new Error("Should have prevented start before initialize");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidKernelStateException,
      "Expected InvalidKernelStateException for START before INITIALIZE"
    );
  }

  // Proper sequence: initialize -> start
  tracker.initOrder = [];
  tracker.startOrder = [];
  tracker.stopOrder = [];

  await lifeKernel.initialize();
  assert(tracker.initOrder.length === 1 && tracker.initOrder[0] === "m1", "m1 initialized");

  await lifeKernel.start();
  assert(tracker.startOrder.length === 1 && tracker.startOrder[0] === "m1", "m1 started");

  // Attempting to register module after initialization
  try {
    await lifeKernel.register(new TestModule("m2", []));
    throw new Error("Should have prevented registration after initialization");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidKernelStateException,
      "Expected InvalidKernelStateException for registering in RUNNING state"
    );
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified initialize/start/stop ordering.");

  // ==========================================
  // 6. Reverse Shutdown Ordering
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n6. Running Reverse Shutdown Ordering...");
  
  const shutdownTracker = { initOrder: [], startOrder: [], stopOrder: [] };
  const sdKernel = new KernelBuilder().withContext(context).build();

  const sdModC = new TestModule("C", [], shutdownTracker);
  const sdModB = new TestModule("B", ["C"], shutdownTracker);
  const sdModA = new TestModule("A", ["B"], shutdownTracker);

  await sdKernel.register(sdModA);
  await sdKernel.register(sdModB);
  await sdKernel.register(sdModC);

  await sdKernel.initialize();
  await sdKernel.start();
  await sdKernel.stop();

  assert(shutdownTracker.stopOrder[0] === "A", "A stopped first (reverse)");
  assert(shutdownTracker.stopOrder[1] === "B", "B stopped second");
  assert(shutdownTracker.stopOrder[2] === "C", "C stopped last");
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified reverse shutdown sequence.");

  // ==========================================
  // 7. Snapshot Immutability Validation
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n7. Running Snapshot Immutability Validation...");
  const snapKernel = new KernelBuilder().withContext(context).build();
  await snapKernel.initialize();
  await snapKernel.start();

  const snap = snapKernel.snapshot();

  // Root mutation
  try {
    (snap as any).state = KernelState.FAILED;
    throw new Error("Should have frozen snapshot root");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Expected TypeError on frozen snapshot root");
  }

  // StartupOrder mutation
  try {
    (snap.startupOrder as any)[0] = "hacked";
    throw new Error("Should have frozen startupOrder");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Expected TypeError on startupOrder modification");
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified deep freeze immutability.");

  // ==========================================
  // 8. Validator Rule Checks
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n8. Running Validator Rule Checks...");

  // Space check
  try {
    KernelValidator.validateIdentifier("invalid module space", "Module ID");
    throw new Error("Should have failed space check");
  } catch (err: unknown) {
    assert(
      err instanceof KernelValidationException,
      "Expected KernelValidationException for space check"
    );
  }

  // Symbol check
  try {
    KernelValidator.validateIdentifier("invalid_mod_@_char", "Module ID");
    throw new Error("Should have failed symbol check");
  } catch (err: unknown) {
    assert(
      err instanceof KernelValidationException,
      "Expected KernelValidationException for symbol check"
    );
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified validator rule constraints.");

  // eslint-disable-next-line no-console
  console.log("\n=== ALL KERNEL INTEGRATION TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Test execution failed:", err);
  process.exit(1);
});
