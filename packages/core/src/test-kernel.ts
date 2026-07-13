import { Kernel } from "./kernel/Kernel";
import { KernelBuilder } from "./kernel/KernelBuilder";
import { KernelState } from "./kernel/KernelState";
import { ServiceToken } from "./kernel/ServiceToken";
import { Version } from "./kernel/Version";
import {
  InvalidKernelStateException,
  ServiceAlreadyRegisteredException,
  ServiceNotFoundException,
} from "./kernel/types";

// Define mock service interfaces
interface ConfigService {
  apiPort: number;
}

interface LoggerService {
  info(msg: string): void;
}

// Define typed Service Tokens
const CONFIG_TOKEN = new ServiceToken<ConfigService>("config");
const LOGGER_TOKEN = new ServiceToken<LoggerService>("logger");
const UNREGISTERED_TOKEN = new ServiceToken<unknown>("database");

/**
 * TestKernel is an internal test spy subclassing Kernel.
 *
 * ARCHITECTURAL EXCEPTION FOR UNIT TESTING:
 * This class exists strictly for testing internal kernel hook coordination.
 * Application and feature modules must never extend the Kernel.
 * Future lifecycle integrations will occur through registration or events.
 */
class TestKernel extends Kernel {
  public hookCalls: string[] = [];

  protected override async beforeInitialize(): Promise<void> {
    this.hookCalls.push("beforeInitialize");
  }
  protected override async afterInitialize(): Promise<void> {
    this.hookCalls.push("afterInitialize");
  }
  protected override async beforeStart(): Promise<void> {
    this.hookCalls.push("beforeStart");
  }
  protected override async afterStart(): Promise<void> {
    this.hookCalls.push("afterStart");
  }
  protected override async beforeStop(): Promise<void> {
    this.hookCalls.push("beforeStop");
  }
  protected override async afterStop(): Promise<void> {
    this.hookCalls.push("afterStop");
  }
}

async function runTests() {
  // eslint-disable-next-line no-console
  console.log("=== START KERNEL ARCHITECTURAL REFINEMENT TESTS ===");

  // ==========================================
  // Test 1: Version Model Tests
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n1. Running Version Model Tests...");
  const v1 = Version.parse("1.2.3-alpha+build01");
  assert(v1.major === 1, "Major version should be 1");
  assert(v1.minor === 2, "Minor version should be 2");
  assert(v1.patch === 3, "Patch version should be 3");
  assert(v1.label === "alpha", "Label should be alpha");
  assert(v1.build === "build01", "Build should be build01");
  assert(v1.toString() === "1.2.3-alpha+build01", "toString format matches");

  // Version Comparison
  const v2 = Version.parse("1.2.3");
  const v3 = Version.parse("2.0.0");
  assert(v1.compare(v2) < 0, "1.2.3-alpha should be older than 1.2.3");
  assert(v3.compare(v2) > 0, "2.0.0 is newer than 1.2.3");
  assert(v2.compare(Version.parse("1.2.3")) === 0, "Versions must be equal");
  assert(v2.equals(Version.parse("1.2.3")), "equals validation");

  // Validation error
  try {
    Version.parse("invalid-version");
    throw new Error("Should have failed parsing invalid semver");
  } catch (err: any) {
    assert(
      err.message.includes("Invalid version format"),
      "Version parsing must throw validation error"
    );
    // eslint-disable-next-line no-console
    console.log("   ✓ Version parsing validation errors verified.");
  }

  // ==========================================
  // Test 2: Kernel Identity and Builder
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n2. Running Kernel Identity & Builder Tests...");
  const versionObj = Version.parse("0.1.0-beta");
  const builder = new KernelBuilder().withVersion(versionObj).withEnvironment("staging");

  const kernel = builder.build();
  assert(kernel.status().state === KernelState.CREATED, "State should be CREATED");

  const initialHealth = kernel.health();
  assert(initialHealth.kernelId !== undefined, "Kernel ID must be defined");
  assert(initialHealth.kernelId.length === 36, "Kernel ID must be a valid UUID");
  assert(initialHealth.version.equals(versionObj), "Version model check in health");
  assert(initialHealth.environment === "staging", "Environment value in health");

  // Verify stable identity (never changes)
  const health2 = kernel.health();
  assert(initialHealth.kernelId === health2.kernelId, "Kernel ID must never change");
  // eslint-disable-next-line no-console
  console.log("   ✓ Stable Kernel UUID generated:", initialHealth.kernelId);

  // ==========================================
  // Test 3: Service Token Registration & Resolution
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n3. Running ServiceToken Registry Tests...");
  const mockConfig: ConfigService = { apiPort: 3000 };
  const mockLogger: LoggerService = {
    info: (msg: string) => {
      // eslint-disable-next-line no-console
      console.log(`[MOCK LOGGER] ${msg}`);
    },
  };

  kernel.register(CONFIG_TOKEN, mockConfig);
  kernel.register(LOGGER_TOKEN, mockLogger);

  // Double registration
  try {
    kernel.register(CONFIG_TOKEN, { apiPort: 80 } as ConfigService);
    throw new Error("Should have thrown ServiceAlreadyRegisteredException");
  } catch (err) {
    assert(
      err instanceof ServiceAlreadyRegisteredException,
      "Throws ServiceAlreadyRegisteredException"
    );
    // eslint-disable-next-line no-console
    console.log("   ✓ Throws ServiceAlreadyRegisteredException on double token registration.");
  }

  // Register in invalid state (should fail once started)
  await kernel.initialize();
  await kernel.start();
  try {
    kernel.register(new ServiceToken<any>("late"), {});
    throw new Error("Should have thrown InvalidKernelStateException");
  } catch (err) {
    assert(
      err instanceof InvalidKernelStateException,
      "Throws InvalidKernelStateException on running registration"
    );
    // eslint-disable-next-line no-console
    console.log("   ✓ Throws InvalidKernelStateException on late service registration.");
  }

  // Resolve services (types are inferred)
  const resolvedConfig: ConfigService = kernel.resolve(CONFIG_TOKEN);
  assert(resolvedConfig.apiPort === 3000, "Resolved service parameter validation");

  const resolvedLogger: LoggerService = kernel.resolve(LOGGER_TOKEN);
  resolvedLogger.info("Resolved services via typed ServiceTokens successfully.");

  // Resolve unregistered
  try {
    kernel.resolve(UNREGISTERED_TOKEN);
    throw new Error("Should have thrown ServiceNotFoundException");
  } catch (err) {
    assert(err instanceof ServiceNotFoundException, "Throws ServiceNotFoundException");
    // eslint-disable-next-line no-console
    console.log("   ✓ Threw ServiceNotFoundException on missing token correctly.");
  }

  // ==========================================
  // Test 4: Context and Health Immutability
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n4. Running Context & Health Tests...");
  const context = (kernel as any).getContext();
  assert(context.metadata.kernelId === initialHealth.kernelId, "Context metadata identity check");
  assert(context.serviceCount === 2, "Context registry service count");
  assert(context.serviceMetadata.length === 2, "Metadata array length matches");
  assert(
    context.serviceMetadata[0].tokenDescription === "config",
    "Metadata service description matches"
  );

  // Verify health properties
  const currentHealth = kernel.health();
  assert(currentHealth.isHealthy === true, "Health status flag");
  assert(currentHealth.uptime >= 0, "Uptime calculation");
  assert(currentHealth.timestamp instanceof Date, "Timestamp exists");

  // ==========================================
  // Test 5: Status Details
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n5. Running Status Tests...");
  const status = kernel.status();
  assert(status.state === KernelState.RUNNING, "Status state");
  assert(status.kernelId === initialHealth.kernelId, "Status contains ID");
  assert(status.timestamp instanceof Date, "Status contains timestamp");

  await kernel.stop();
  assert(kernel.status().state === KernelState.STOPPED, "Stopped state");

  // ==========================================
  // Test 6: Lifecycle Hooks Execution
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n6. Running Lifecycle Hooks Tests...");
  const hookKernel = new TestKernel(Version.parse("1.0.0"), "test");
  assert(hookKernel.hookCalls.length === 0, "No hooks executed on CREATED");

  await hookKernel.initialize();
  assert(
    hookKernel.hookCalls[0] === "beforeInitialize" && hookKernel.hookCalls[1] === "afterInitialize",
    "before/after initialize hooks"
  );

  await hookKernel.start();
  assert(
    hookKernel.hookCalls[2] === "beforeStart" && hookKernel.hookCalls[3] === "afterStart",
    "before/after start hooks"
  );

  await hookKernel.stop();
  assert(
    hookKernel.hookCalls[4] === "beforeStop" && hookKernel.hookCalls[5] === "afterStop",
    "before/after stop hooks"
  );
  // eslint-disable-next-line no-console
  console.log("   ✓ Protected hooks ran in correct order:", hookKernel.hookCalls.join(" -> "));

  // eslint-disable-next-line no-console
  console.log("\n=== ALL KERNEL ARCHITECTURAL REFINEMENT TESTS PASSED SUCCESSFULLY ===");
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
