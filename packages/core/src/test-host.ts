import { HostBuilder } from "./host/HostBuilder";
import { HostContext } from "./host/HostContext";
import { HostedService } from "./host/HostedService";
import { HostState } from "./host/HostState";
import { HostValidator } from "./host/HostValidator";
import { IBootstrapper } from "./bootstrap/IBootstrapper";
import { BootstrapManifest } from "./bootstrap/BootstrapManifest";
import { BootstrapSnapshot } from "./bootstrap/BootstrapSnapshot";
import { BootstrapState } from "./bootstrap/BootstrapState";
import {
  HostValidationException,
  InvalidHostStateException,
} from "./host/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    // eslint-disable-next-line no-console
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

// Sequence execution tracker
const executionOrder: string[] = [];

class MockBootstrapper implements IBootstrapper {
  public initialized = false;
  public bootstrapped = false;
  public shutDown = false;

  public async initialize(): Promise<void> {
    this.initialized = true;
    executionOrder.push("bootstrap_init");
  }

  public async bootstrap(): Promise<void> {
    this.bootstrapped = true;
    executionOrder.push("bootstrap_run");
  }

  public async shutdown(): Promise<void> {
    this.shutDown = true;
    executionOrder.push("bootstrap_shutdown");
  }

  public async loadManifest(manifest: BootstrapManifest): Promise<void> {}
  
  public manifest(): BootstrapManifest {
    return { version: "1.0", modules: [] };
  }

  public snapshot(): BootstrapSnapshot {
    return {
      timestamp: new Date(),
      state: BootstrapState.RUNNING,
      manifest: this.manifest(),
      sequence: { steps: [], timestamp: new Date() },
      metadata: {},
    };
  }
}

class MockHostedService implements HostedService {
  constructor(public readonly id: string) {}

  public async initialize(): Promise<void> {
    executionOrder.push(`service_init_${this.id}`);
  }

  public async start(): Promise<void> {
    executionOrder.push(`service_start_${this.id}`);
  }

  public async stop(): Promise<void> {
    executionOrder.push(`service_stop_${this.id}`);
  }
}

async function runTests() {
  // eslint-disable-next-line no-console
  console.log("=== START APPLICATION HOST TESTS ===");

  const context: HostContext = {
    env: "test",
    namespace: "studio-host",
    metadata: { version: "1.0.0" },
  };

  const bootstrapper = new MockBootstrapper();

  // ==========================================
  // 1. Running Builder Validation...
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("1. Running Builder Validation...");
  const host = new HostBuilder()
    .withContext(context)
    .withBootstrapper(bootstrapper)
    .withMetadata({ module: "main-host" })
    .build();

  assert(host !== null, "Host instance must build successfully");

  try {
    new HostBuilder().withBootstrapper(bootstrapper).build();
    throw new Error("Should have rejected missing context");
  } catch (err: unknown) {
    assert(
      err instanceof HostValidationException,
      "Expected HostValidationException for missing context"
    );
  }

  try {
    new HostBuilder().withContext(context).build();
    throw new Error("Should have rejected missing bootstrapper");
  } catch (err: unknown) {
    assert(
      err instanceof HostValidationException,
      "Expected HostValidationException for missing bootstrapper"
    );
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified Builder Validation.");

  // ==========================================
  // 2. Running Hosted Service Registration...
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("2. Running Hosted Service Registration...");
  const activeHost = new HostBuilder().withContext(context).withBootstrapper(bootstrapper).build();

  const service1 = new MockHostedService("serviceA");
  await activeHost.register(service1);

  assert(activeHost.has("serviceA"), "Should register serviceA");
  assert(activeHost.get("serviceA") === service1, "Get returns correct service");
  assert(activeHost.list().length === 1, "List returns exactly 1 service");

  // Duplicate registration check
  try {
    await activeHost.register(new MockHostedService("serviceA"));
    throw new Error("Should have rejected duplicate service ID registration");
  } catch (err: unknown) {
    assert(
      err instanceof HostValidationException,
      "Expected HostValidationException for duplicate ID"
    );
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified registration, lookup, duplicates.");

  // ==========================================
  // 3. Running Startup Ordering...
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("3. Running Startup Ordering...");
  executionOrder.length = 0; // reset

  await activeHost.initialize();
  await activeHost.start();

  // Startup sequence: Bootstrap/Kernel first, then Hosted Services.
  // In initialize(): bootstrap_init, then service_init.
  // In start(): bootstrap_run, then service_start.
  assert(executionOrder[0] === "bootstrap_init", "Bootstrap must initialize first");
  assert(executionOrder[1] === "service_init_serviceA", "Hosted service initializes after bootstrap");
  assert(executionOrder[2] === "bootstrap_run", "Bootstrap runs next (Kernel starts)");
  assert(executionOrder[3] === "service_start_serviceA", "Hosted service starts after Kernel is running");

  // eslint-disable-next-line no-console
  console.log("   ✓ Verified Bootstrap → Kernel → Hosted Services.");

  // ==========================================
  // 4. Running Shutdown Ordering...
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("4. Running Shutdown Ordering...");
  // Shutdown sequence: Hosted Services stop first, then Kernel shutdown.
  executionOrder.length = 0; // reset

  await activeHost.stop();
  assert(executionOrder[0] === "service_stop_serviceA", "Hosted service stops first");
  assert(executionOrder[1] === "bootstrap_shutdown", "Bootstrap/Kernel shuts down after hosted services");

  // eslint-disable-next-line no-console
  console.log("   ✓ Verified Hosted Services → Kernel → Bootstrap.");

  // ==========================================
  // 5. Running Lifecycle Validation...
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("5. Running Lifecycle Validation...");
  const lifeHost = new HostBuilder().withContext(context).withBootstrapper(bootstrapper).build();

  // State: CREATED
  try {
    await lifeHost.start();
    throw new Error("Should have prevented start before initialize");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidHostStateException,
      "Expected InvalidHostStateException for start before initialize"
    );
  }

  await lifeHost.initialize();
  // State: READY
  await lifeHost.start();
  // State: RUNNING

  // Try to register service when RUNNING
  try {
    await lifeHost.register(new MockHostedService("serviceB"));
    throw new Error("Should have prevented registration when RUNNING");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidHostStateException,
      "Expected InvalidHostStateException for registering when RUNNING"
    );
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified initialize/start/stop transitions.");

  // ==========================================
  // 6. Running Snapshot Immutability Validation...
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("6. Running Snapshot Immutability Validation...");
  const snapHost = new HostBuilder().withContext(context).withBootstrapper(bootstrapper).build();
  await snapHost.initialize();
  await snapHost.start();

  const snap = snapHost.snapshot();

  // Snapshot root freeze check
  try {
    (snap as any).state = HostState.FAILED;
    throw new Error("Should have frozen snapshot root");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Expected TypeError on modifying snapshot");
  }

  // Services list freeze check
  try {
    (snap.services as any)[0] = null;
    throw new Error("Should have frozen services list");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Expected TypeError on modifying services array");
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified deep freeze immutability.");

  // ==========================================
  // 7. Running Validator Rule Checks...
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("7. Running Validator Rule Checks...");

  // Space check
  try {
    HostValidator.validateIdentifier("invalid id space", "Service ID");
    throw new Error("Should have failed space check");
  } catch (err: unknown) {
    assert(
      err instanceof HostValidationException,
      "Expected HostValidationException for space check"
    );
  }

  // Symbol check
  try {
    HostValidator.validateIdentifier("invalid_id_@_char", "Service ID");
    throw new Error("Should have failed symbol check");
  } catch (err: unknown) {
    assert(
      err instanceof HostValidationException,
      "Expected HostValidationException for symbol check"
    );
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified validator rule constraints.");

  // eslint-disable-next-line no-console
  console.log("\n=== ALL APPLICATION HOST TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Test execution failed:", err);
  process.exit(1);
});
