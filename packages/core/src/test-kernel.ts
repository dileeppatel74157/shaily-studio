import { KernelBuilder } from "./kernel/KernelBuilder";
import { KernelState } from "./kernel/KernelState";
import {
  InvalidKernelStateException,
  ServiceAlreadyRegisteredException,
  ServiceNotFoundException,
} from "./kernel/types";

async function runTests() {
  // eslint-disable-next-line no-console
  console.log("=== START KERNEL VERIFICATION TESTS ===");

  // 1. Instantiation via Builder
  // eslint-disable-next-line no-console
  console.log("1. Building Kernel via KernelBuilder...");
  const builder = new KernelBuilder().withVersion("1.0.0-test").withEnvironment("test");

  const kernel = builder.build();
  assert(kernel.status() === KernelState.CREATED, "Kernel state should be CREATED on build");

  // 2. Service Registration
  // eslint-disable-next-line no-console
  console.log("2. Registering mock services...");
  const mockConfig = { apiPort: 8080 };
  const mockLogger = {
    info: (msg: string) => {
      // eslint-disable-next-line no-console
      console.log(`[MOCK LOG] ${msg}`);
    },
  };

  kernel.register("config", mockConfig);
  kernel.register("logger", mockLogger);

  // Test double registration exception
  try {
    kernel.register("config", {});
    throw new Error("Should have thrown ServiceAlreadyRegisteredException");
  } catch (err) {
    assert(err instanceof ServiceAlreadyRegisteredException, "Should throw ServiceAlreadyRegisteredException");
    // eslint-disable-next-line no-console
    console.log("   ✓ Prevented double service registration correctly.");
  }

  // 3. Initialization
  // eslint-disable-next-line no-console
  console.log("3. Initializing Kernel...");
  await kernel.initialize();
  assert(kernel.status() === KernelState.READY, "Kernel state should be READY after initialize()");

  // Test illegal double initialization
  try {
    await kernel.initialize();
    throw new Error("Should have thrown InvalidKernelStateException");
  } catch (err) {
    assert(err instanceof InvalidKernelStateException, "Should throw InvalidKernelStateException");
    // eslint-disable-next-line no-console
    console.log("   ✓ Prevented double initialization correctly.");
  }

  // 4. Start
  // eslint-disable-next-line no-console
  console.log("4. Starting Kernel...");
  await kernel.start();
  assert(kernel.status() === KernelState.RUNNING, "Kernel state should be RUNNING after start()");

  // Test health check
  const health = kernel.health();
  // eslint-disable-next-line no-console
  console.log("   Uptime (ms):", health.uptime);
  // eslint-disable-next-line no-console
  console.log("   Registered Service Count:", health.registeredServiceCount);
  assert(health.state === KernelState.RUNNING, "Health report should reflect RUNNING status");
  assert(health.registeredServiceCount === 2, "Health report should show 2 registered services");

  // 5. Service Resolution
  // eslint-disable-next-line no-console
  console.log("5. Resolving services...");
  const resolvedConfig = kernel.resolve<{ apiPort: number }>("config");
  assert(resolvedConfig.apiPort === 8080, "Resolved config should match registered config");

  const resolvedLogger = kernel.resolve<{ info: (msg: string) => void }>("logger");
  resolvedLogger.info("Kernel successfully resolved logger and ran log function!");

  // Test resolving non-existent service
  try {
    kernel.resolve("database");
    throw new Error("Should have thrown ServiceNotFoundException");
  } catch (err) {
    assert(err instanceof ServiceNotFoundException, "Should throw ServiceNotFoundException");
    // eslint-disable-next-line no-console
    console.log("   ✓ Threw ServiceNotFoundException on missing service correctly.");
  }

  // 6. Stop
  // eslint-disable-next-line no-console
  console.log("6. Stopping Kernel...");
  await kernel.stop();
  assert(kernel.status() === KernelState.STOPPED, "Kernel state should be STOPPED after stop()");

  // Test action in invalid state after stop
  try {
    kernel.register("new-service", {});
    throw new Error("Should have thrown InvalidKernelStateException");
  } catch (err) {
    assert(err instanceof InvalidKernelStateException, "Should throw InvalidKernelStateException");
    // eslint-disable-next-line no-console
    console.log("   ✓ Prevented service registration on stopped kernel correctly.");
  }

  // eslint-disable-next-line no-console
  console.log("=== ALL KERNEL VERIFICATION TESTS PASSED SUCCESSFULLY ===");
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    // eslint-disable-next-line no-console
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

runTests().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Test execution failed:", err);
  process.exit(1);
});
