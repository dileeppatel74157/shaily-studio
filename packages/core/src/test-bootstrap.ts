import { BootstrapBuilder } from "./bootstrap/BootstrapBuilder";
import { BootstrapContext } from "./bootstrap/BootstrapContext";
import { BootstrapManifest } from "./bootstrap/BootstrapManifest";
import { BootstrapState } from "./bootstrap/BootstrapState";
import { BootstrapValidator } from "./bootstrap/BootstrapValidator";
import { DependencyScanner } from "./bootstrap/DependencyScanner";
import { KernelModule } from "./kernel/KernelModule";
import {
  BootstrapException,
  BootstrapValidationException,
  InvalidBootstrapStateException,
} from "./bootstrap/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    // eslint-disable-next-line no-console
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

class MockKernelModule implements KernelModule {
  public initialized = false;
  public started = false;
  public stopped = false;

  constructor(
    public readonly id: string,
    public readonly dependencies: readonly string[],
    public readonly config?: Record<string, unknown>
  ) {}

  public async initialize(): Promise<void> {
    this.initialized = true;
  }
  public async start(): Promise<void> {
    this.started = true;
  }
  public async stop(): Promise<void> {
    this.stopped = true;
  }
}

async function runTests() {
  // eslint-disable-next-line no-console
  console.log("=== START BOOTSTRAP FRAMEWORK TESTS ===");

  const context: BootstrapContext = {
    env: "test",
    namespace: "studio-bootstrap",
    metadata: { version: "1.0.0" },
  };

  // ==========================================
  // 1. Running Builder Validation...
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("1. Running Builder Validation...");
  const bootstrapper = new BootstrapBuilder()
    .withContext(context)
    .withMetadata({ debug: true })
    .build();

  assert(bootstrapper !== null, "Bootstrapper instance must be created");

  try {
    new BootstrapBuilder().build();
    throw new Error("Should have rejected missing context");
  } catch (err: unknown) {
    assert(
      err instanceof BootstrapValidationException,
      "Expected BootstrapValidationException for missing context"
    );
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified Builder Validation.");

  // ==========================================
  // 2. Running Manifest Validation...
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("2. Running Manifest Validation...");
  
  // Valid Manifest
  const validManifest: BootstrapManifest = {
    version: "1.0",
    modules: [
      { id: "logger", dependencies: [], enabled: true },
      { id: "security", dependencies: ["logger"], enabled: true },
    ],
  };
  BootstrapValidator.validateManifest(validManifest);

  // Invalid manifest missing version
  try {
    BootstrapValidator.validateManifest({
      version: "",
      modules: [],
    });
    throw new Error("Should have rejected empty version");
  } catch (err: unknown) {
    assert(
      err instanceof BootstrapValidationException,
      "Expected BootstrapValidationException for empty version"
    );
  }

  // Duplicate ID in manifest
  try {
    BootstrapValidator.validateManifest({
      version: "1.0",
      modules: [
        { id: "logger", dependencies: [], enabled: true },
        { id: "logger", dependencies: [], enabled: true },
      ],
    });
    throw new Error("Should have rejected duplicate module IDs");
  } catch (err: unknown) {
    assert(
      err instanceof BootstrapValidationException,
      "Expected BootstrapValidationException for duplicate ID"
    );
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified manifest parsing and validation.");

  // ==========================================
  // 3. Running Dependency Scanner...
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("3. Running Dependency Scanner...");

  // Topological sorting (A depends on B, B has no dependencies)
  const manifestDep: BootstrapManifest = {
    version: "1.0",
    modules: [
      { id: "A", dependencies: ["B"], enabled: true },
      { id: "B", dependencies: [], enabled: true },
    ],
  };

  const order = DependencyScanner.scan(manifestDep);
  assert(order[0] === "B", "B must boot first");
  assert(order[1] === "A", "A must boot second");

  // Circular dependency detection
  const circularManifest: BootstrapManifest = {
    version: "1.0",
    modules: [
      { id: "A", dependencies: ["B"], enabled: true },
      { id: "B", dependencies: ["C"], enabled: true },
      { id: "C", dependencies: ["A"], enabled: true },
    ],
  };

  try {
    DependencyScanner.scan(circularManifest);
    throw new Error("Should have detected circular dependency");
  } catch (err: unknown) {
    assert(
      err instanceof BootstrapValidationException,
      "Expected CircularDependencyException mapping"
    );
  }

  // Missing or disabled dependency detection
  const missingManifest: BootstrapManifest = {
    version: "1.0",
    modules: [
      { id: "A", dependencies: ["disabledB"], enabled: true },
      { id: "disabledB", dependencies: [], enabled: false }, // Disabled!
    ],
  };

  try {
    DependencyScanner.scan(missingManifest);
    throw new Error("Should have rejected missing/disabled dependency");
  } catch (err: unknown) {
    assert(
      err instanceof BootstrapValidationException,
      "Expected BootstrapValidationException for missing dependency"
    );
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified dependency ordering and graph validation.");

  // ==========================================
  // 4. Running Module Loader...
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("4. Running Module Loader...");

  const loadedModulesRecord: string[] = [];
  const bootForLoading = new BootstrapBuilder()
    .withContext(context)
    .withModuleFactory("logger", (cfg) => {
      loadedModulesRecord.push("logger");
      return new MockKernelModule("logger", [], cfg);
    })
    .withModuleFactory("security", (cfg) => {
      loadedModulesRecord.push("security");
      return new MockKernelModule("security", ["logger"], cfg);
    })
    .build();

  await bootForLoading.loadManifest(validManifest);
  await bootForLoading.bootstrap();

  assert(loadedModulesRecord.length === 2, "Loaded exactly 2 modules");
  assert(loadedModulesRecord[0] === "logger", "First module loaded is logger");
  assert(loadedModulesRecord[1] === "security", "Second module loaded is security");

  // eslint-disable-next-line no-console
  console.log("   ✓ Verified enabled modules loaded correctly.");

  // ==========================================
  // 5. Running Bootstrap Lifecycle...
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("5. Running Bootstrap Lifecycle...");

  const stateBootstrapper = new BootstrapBuilder().withContext(context).build();

  // Try bootstrap before initialize or loading manifest
  try {
    await stateBootstrapper.bootstrap();
    throw new Error("Should have prevented bootstrapping without manifest");
  } catch (err: unknown) {
    assert(
      err instanceof BootstrapValidationException || err instanceof InvalidBootstrapStateException,
      "Expected error for unconfigured state bootstrap"
    );
  }

  // CREATED -> READY via loadManifest
  await stateBootstrapper.loadManifest(validManifest);

  // Illegal transition: STOPPED or SHUTDOWN before boot
  try {
    await stateBootstrapper.shutdown();
    throw new Error("Should have prevented shutdown before running");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidBootstrapStateException,
      "Expected InvalidBootstrapStateException for shutdown before running"
    );
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified initialize, bootstrap, shutdown ordering.");

  // ==========================================
  // 6. Running Disabled Module Handling...
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("6. Running Disabled Module Handling...");

  const loadedTracker: string[] = [];
  const bootForDisableCheck = new BootstrapBuilder()
    .withContext(context)
    .withModuleFactory("logger", () => {
      loadedTracker.push("logger");
      return new MockKernelModule("logger", []);
    })
    .withModuleFactory("security", () => {
      loadedTracker.push("security");
      return new MockKernelModule("security", []);
    })
    .build();

  const disableManifest: BootstrapManifest = {
    version: "1.0",
    modules: [
      { id: "logger", dependencies: [], enabled: true },
      { id: "security", dependencies: [], enabled: false }, // Disabled!
    ],
  };

  await bootForDisableCheck.loadManifest(disableManifest);
  await bootForDisableCheck.bootstrap();

  assert(loadedTracker.length === 1, "Only 1 module loaded");
  assert(loadedTracker[0] === "logger", "Security was skipped");
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified disabled modules skipped.");

  // ==========================================
  // 7. Running Snapshot Immutability Validation...
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("7. Running Snapshot Immutability Validation...");

  const snapBoot = new BootstrapBuilder()
    .withContext(context)
    .withModuleFactory("logger", () => new MockKernelModule("logger", []))
    .build();

  await snapBoot.loadManifest({
    version: "1.0",
    modules: [{ id: "logger", dependencies: [], enabled: true }],
  });
  await snapBoot.bootstrap();

  const snapshot = snapBoot.snapshot();

  // Root freeze check
  try {
    (snapshot as any).state = BootstrapState.FAILED;
    throw new Error("Should have frozen snapshot root");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Expected TypeError on modifying frozen snapshot");
  }

  // Manifest freeze check
  try {
    (snapshot.manifest as any).version = "2.0";
    throw new Error("Should have frozen manifest");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Expected TypeError on modifying frozen manifest");
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified deep freeze immutability.");

  // ==========================================
  // 8. Running Validator Rule Checks...
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("8. Running Validator Rule Checks...");

  // Identifier space validation
  try {
    BootstrapValidator.validateIdentifier("invalid id space", "Module ID");
    throw new Error("Should have failed space check");
  } catch (err: unknown) {
    assert(
      err instanceof BootstrapValidationException,
      "Expected BootstrapValidationException for space check"
    );
  }

  // Identifier symbol validation
  try {
    BootstrapValidator.validateIdentifier("invalid_id_@_char", "Module ID");
    throw new Error("Should have failed symbol check");
  } catch (err: unknown) {
    assert(
      err instanceof BootstrapValidationException,
      "Expected BootstrapValidationException for symbol check"
    );
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified validator rule constraints.");

  // eslint-disable-next-line no-console
  console.log("\n=== ALL BOOTSTRAP FRAMEWORK TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Test execution failed:", err);
  process.exit(1);
});
