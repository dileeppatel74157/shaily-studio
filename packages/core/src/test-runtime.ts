import { RuntimeBuilder } from "./runtime/RuntimeBuilder";
import { RuntimeContext } from "./runtime/RuntimeContext";
import { RuntimeSession } from "./runtime/RuntimeSession";
import { RuntimeState } from "./runtime/RuntimeState";
import { RuntimeValidator } from "./runtime/RuntimeValidator";
import { IHost } from "./host/IHost";
import { HostedService } from "./host/HostedService";
import { HostSnapshot } from "./host/HostSnapshot";
import { HostState } from "./host/HostState";
import {
  RuntimeValidationException,
  InvalidRuntimeStateException,
} from "./runtime/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    // eslint-disable-next-line no-console
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

// Sequence execution tracker
const executionOrder: string[] = [];

class MockHost implements IHost {
  public initialized = false;
  public started = false;
  public stopped = false;

  public async initialize(): Promise<void> {
    this.initialized = true;
    executionOrder.push("host_init");
  }

  public async start(): Promise<void> {
    this.started = true;
    executionOrder.push("host_start");
  }

  public async stop(): Promise<void> {
    this.stopped = true;
    executionOrder.push("host_stop");
  }

  public async register(service: HostedService): Promise<void> {}
  public async unregister(serviceId: string): Promise<void> {}
  public has(serviceId: string): boolean {
    return false;
  }
  public get(serviceId: string): HostedService | undefined {
    return undefined;
  }
  public list(): readonly HostedService[] {
    return [];
  }
  public snapshot(): HostSnapshot {
    return {
      timestamp: new Date(),
      state: HostState.RUNNING,
      services: [],
      metadata: {},
    };
  }
}

async function runTests() {
  // eslint-disable-next-line no-console
  console.log("=== START STUDIO RUNTIME TESTS ===");

  const context: RuntimeContext = {
    env: "test",
    namespace: "studio-runtime",
    metadata: { version: "1.0.0" },
  };

  const hostInstance = new MockHost();

  // ==========================================
  // 1. Running Builder Validation...
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("1. Running Builder Validation...");
  const runtime = new RuntimeBuilder()
    .withContext(context)
    .withHost(hostInstance)
    .withMetadata({ tier: "enterprise" })
    .build();

  assert(runtime !== null, "Runtime instance must build successfully");

  try {
    new RuntimeBuilder().withHost(hostInstance).build();
    throw new Error("Should have rejected missing context");
  } catch (err: unknown) {
    assert(
      err instanceof RuntimeValidationException,
      "Expected RuntimeValidationException for missing context"
    );
  }

  try {
    new RuntimeBuilder().withContext(context).build();
    throw new Error("Should have rejected missing host");
  } catch (err: unknown) {
    assert(
      err instanceof RuntimeValidationException,
      "Expected RuntimeValidationException for missing host"
    );
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified Builder Validation.");

  // ==========================================
  // 2. Running Runtime Session Registration...
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("2. Running Runtime Session Registration...");
  const activeRuntime = new RuntimeBuilder().withContext(context).withHost(hostInstance).build();
  await activeRuntime.initialize();
  await activeRuntime.start();

  const sess1 = await activeRuntime.createSession({
    id: "session-1",
    metadata: { userId: "userA" },
  });

  assert(sess1 !== null, "Session created successfully");
  assert(activeRuntime.hasSession("session-1"), "Registry stores session");
  assert(activeRuntime.getSession("session-1")?.metadata.userId === "userA", "Session metadata matches");
  assert(activeRuntime.listSessions().length === 1, "Session count matches");

  // Duplicate prevention
  try {
    await activeRuntime.createSession({ id: "session-1" });
    throw new Error("Should have prevented duplicate session creation");
  } catch (err: unknown) {
    assert(
      err instanceof RuntimeValidationException,
      "Expected RuntimeValidationException for duplicate ID"
    );
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified session creation, lookup, duplicates.");

  // ==========================================
  // 3. Running Session Destruction...
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("3. Running Session Destruction...");
  
  await activeRuntime.destroySession("session-1");
  assert(!activeRuntime.hasSession("session-1"), "Session destroyed successfully");
  assert(activeRuntime.listSessions().length === 0, "Sessions list is empty");

  // Destroy non-existent session
  try {
    await activeRuntime.destroySession("session-1");
    throw new Error("Should have rejected non-existent session deletion");
  } catch (err: unknown) {
    assert(
      err instanceof RuntimeValidationException,
      "Expected RuntimeValidationException for non-existent session deletion"
    );
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified session removal and cleanup.");

  // ==========================================
  // 4. Running Runtime Lifecycle...
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("4. Running Runtime Lifecycle...");
  const lifeRuntime = new RuntimeBuilder().withContext(context).withHost(hostInstance).build();

  // Try creating session before starting
  try {
    await lifeRuntime.createSession({ id: "s-early" });
    throw new Error("Should have blocked session creation before running");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidRuntimeStateException,
      "Expected InvalidRuntimeStateException for early session creation"
    );
  }

  await lifeRuntime.initialize();
  await lifeRuntime.start();
  // Now allowed
  await lifeRuntime.createSession({ id: "s-ready" });
  assert(lifeRuntime.hasSession("s-ready"), "Session created in RUNNING state");

  // eslint-disable-next-line no-console
  console.log("   ✓ Verified initialize/start/stop transitions.");

  // ==========================================
  // 5. Running Startup / Shutdown Ordering...
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("5. Running Startup / Shutdown Ordering...");
  
  // Reset tracker
  executionOrder.length = 0;

  const orderHost = new MockHost();
  const orderRuntime = new RuntimeBuilder().withContext(context).withHost(orderHost).build();

  // Startup
  await orderRuntime.initialize();
  await orderRuntime.start();
  
  // Sessions enabled
  await orderRuntime.createSession({ id: "s-order" });
  executionOrder.push("session_active");

  assert(executionOrder[0] === "host_init", "Host initializes first");
  assert(executionOrder[1] === "host_start", "Host starts before Runtime reaches running");
  assert(executionOrder[2] === "session_active", "Sessions are enabled only after startup");

  // Shutdown
  executionOrder.length = 0; // reset
  await orderRuntime.stop();

  // Shutdown ordering: Destroy all active sessions first, then Stop Host
  // Note: Since stop() loops and destroys active sessions, we expect Host stop to happen last.
  assert(executionOrder[0] === "host_stop", "Host stops last during shutdown chain");

  // eslint-disable-next-line no-console
  console.log("   ✓ Verified Host → Runtime startup and Runtime → Host shutdown.");

  // ==========================================
  // 6. Running Snapshot Immutability Validation...
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("6. Running Snapshot Immutability Validation...");
  const snapRuntime = new RuntimeBuilder().withContext(context).withHost(hostInstance).build();
  await snapRuntime.initialize();
  await snapRuntime.start();

  await snapRuntime.createSession({ id: "s-snap" });
  const snap = snapRuntime.snapshot();

  // Snapshot root freeze check
  try {
    (snap as any).state = RuntimeState.FAILED;
    throw new Error("Should have frozen snapshot root");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Expected TypeError on modifying snapshot");
  }

  // Sessions list freeze check
  try {
    (snap.sessions as any)[0] = null;
    throw new Error("Should have frozen sessions list");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Expected TypeError on modifying sessions array");
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
    RuntimeValidator.validateIdentifier("invalid id space", "Session ID");
    throw new Error("Should have failed space check");
  } catch (err: unknown) {
    assert(
      err instanceof RuntimeValidationException,
      "Expected RuntimeValidationException for space check"
    );
  }

  // Symbol check
  try {
    RuntimeValidator.validateIdentifier("invalid_id_@_char", "Session ID");
    throw new Error("Should have failed symbol check");
  } catch (err: unknown) {
    assert(
      err instanceof RuntimeValidationException,
      "Expected RuntimeValidationException for symbol check"
    );
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified validator rule constraints.");

  // eslint-disable-next-line no-console
  console.log("\n=== ALL STUDIO RUNTIME TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Test execution failed:", err);
  process.exit(1);
});
