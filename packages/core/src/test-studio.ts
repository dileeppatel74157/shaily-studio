import { StudioBuilder } from "./studio/StudioBuilder";
import { StudioContext } from "./studio/StudioContext";
import { StudioState } from "./studio/StudioState";
import { StudioValidator } from "./studio/StudioValidator";
import { IRuntime } from "./runtime/IRuntime";
import { IHost } from "./host/IHost";
import { IBootstrapper } from "./bootstrap/IBootstrapper";
import { IKernel } from "./kernel/IKernel";
import { IConfiguration } from "./configuration/IConfiguration";
import { ISecurity } from "./security/ISecurity";
import { IObservability } from "./observability/IObservability";
import { IStorage } from "./storage/IStorage";
import { IScheduler } from "./scheduler/IScheduler";
import {
  StudioValidationException,
  InvalidStudioStateException,
} from "./studio/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    // eslint-disable-next-line no-console
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

// Sequence execution tracker
const executionOrder: string[] = [];

class MockRuntime implements IRuntime {
  public async initialize(): Promise<void> {
    executionOrder.push("runtime_init");
  }
  public async start(): Promise<void> {
    executionOrder.push("runtime_start");
  }
  public async stop(): Promise<void> {
    executionOrder.push("runtime_stop");
  }
  public async createSession(): Promise<any> {
    return {};
  }
  public async destroySession(): Promise<void> {}
  public hasSession(): boolean {
    return false;
  }
  public getSession(): any {
    return undefined;
  }
  public listSessions(): readonly any[] {
    return [];
  }
  public snapshot(): any {
    return { timestamp: new Date(), state: "RUNNING", sessions: [] };
  }
}

class MockHost implements IHost {
  public async initialize(): Promise<void> {}
  public async start(): Promise<void> {}
  public async stop(): Promise<void> {}
  public async register(): Promise<void> {}
  public async unregister(): Promise<void> {}
  public has(): boolean {
    return false;
  }
  public get(): any {
    return undefined;
  }
  public list(): readonly any[] {
    return [];
  }
  public snapshot(): any {
    return { timestamp: new Date(), services: [] };
  }
}

class MockBootstrapper implements IBootstrapper {
  public async initialize(): Promise<void> {}
  public async bootstrap(): Promise<void> {}
  public async shutdown(): Promise<void> {}
  public async loadManifest(): Promise<void> {}
  public manifest(): any {
    return { version: "1.0", modules: [] };
  }
  public snapshot(): any {
    return { timestamp: new Date(), steps: [] };
  }
}

class MockKernel implements IKernel {
  public async initialize(): Promise<void> {}
  public async start(): Promise<void> {}
  public async stop(): Promise<void> {}
  public async register(): Promise<void> {}
  public async unregister(): Promise<void> {}
  public has(): boolean {
    return false;
  }
  public get(): any {
    return undefined;
  }
  public list(): readonly any[] {
    return [];
  }
  public snapshot(): any {
    return { timestamp: new Date(), state: "RUNNING", modules: [] };
  }
}

class MockConfiguration implements IConfiguration {
  public async initialize(): Promise<void> {}
  public async start(): Promise<void> {}
  public async stop(): Promise<void> {}
  public get(): any {
    return undefined;
  }
  public async set(): Promise<void> {}
  public has(): boolean {
    return false;
  }
  public async remove(): Promise<void> {}
  public async registerProvider(): Promise<void> {}
  public async unregisterProvider(): Promise<void> {}
  public async reload(): Promise<void> {}
  public snapshot(): any {
    return {};
  }
  public watch(): string {
    return "";
  }
  public unwatch(): boolean {
    return true;
  }
}

class MockSecurity implements ISecurity {
  public async initialize(): Promise<void> {}
  public async start(): Promise<void> {}
  public async stop(): Promise<void> {}
  public async authenticate(): Promise<any> {
    return {};
  }
  public async authorize(): Promise<any> {
    return {};
  }
  public async encrypt(): Promise<any> {
    return new Uint8Array();
  }
  public async decrypt(): Promise<any> {
    return new Uint8Array();
  }
  public async audit(): Promise<void> {}
  public snapshot(): any {
    return {};
  }
}

class MockObservability implements IObservability {
  public async initialize(): Promise<void> {}
  public async start(): Promise<void> {}
  public async stop(): Promise<void> {}
  public recordMetric(): void {}
  public startSpan(): any {
    return {};
  }
  public endSpan(): void {}
  public health(): any {
    return {};
  }
  public snapshot(): any {
    return {};
  }
}

class MockStorage implements IStorage {
  public async initialize(): Promise<void> {}
  public async start(): Promise<void> {}
  public async stop(): Promise<void> {}
  public async createBucket(): Promise<void> {}
  public async deleteBucket(): Promise<void> {}
  public hasBucket(): boolean {
    return false;
  }
  public getBucket(): any {
    return undefined;
  }
  public listBuckets(): readonly any[] {
    return [];
  }
  public async putObject(): Promise<void> {}
  public getObject(): any {
    return undefined;
  }
  public async deleteObject(): Promise<void> {}
  public listObjects(): readonly any[] {
    return [];
  }
  public snapshot(): any {
    return {};
  }
}

class MockScheduler implements IScheduler {
  public async initialize(): Promise<void> {}
  public async start(): Promise<void> {}
  public async stop(): Promise<void> {}
  public async schedule(): Promise<void> {}
  public async unschedule(): Promise<void> {}
  public has(): boolean {
    return false;
  }
  public get(): any {
    return undefined;
  }
  public list(): readonly any[] {
    return [];
  }
  public async trigger(): Promise<void> {}
  public async pause(): Promise<void> {}
  public async resume(): Promise<void> {}
  public snapshot(): any {
    return {};
  }
}

async function runTests() {
  // eslint-disable-next-line no-console
  console.log("=== START STUDIO COMPOSITION TESTS ===");

  const context: StudioContext = {
    env: "test",
    namespace: "studio-composition",
    metadata: { version: "1.0.0" },
  };

  const mRuntime = new MockRuntime();
  const mHost = new MockHost();
  const mBootstrapper = new MockBootstrapper();
  const mKernel = new MockKernel();
  const mConfiguration = new MockConfiguration();
  const mSecurity = new MockSecurity();
  const mObservability = new MockObservability();
  const mStorage = new MockStorage();
  const mScheduler = new MockScheduler();

  // ==========================================
  // 1. Running Builder Validation...
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("1. Running Builder Validation...");
  
  const studio = new StudioBuilder()
    .withContext(context)
    .withRuntime(mRuntime)
    .withHost(mHost)
    .withBootstrapper(mBootstrapper)
    .withKernel(mKernel)
    .withConfiguration(mConfiguration)
    .withSecurity(mSecurity)
    .withObservability(mObservability)
    .withStorage(mStorage)
    .withScheduler(mScheduler)
    .withMetadata({ app: "shaily-studio-app" })
    .build();

  assert(studio !== null, "Studio instance must compile and build successfully");

  try {
    new StudioBuilder().withRuntime(mRuntime).build();
    throw new Error("Should have rejected missing context");
  } catch (err: unknown) {
    assert(
      err instanceof StudioValidationException,
      "Expected StudioValidationException for missing context"
    );
  }
  // eslint-disable-next-line no-console
  console.log("✓ Verified Builder Validation.");

  // ==========================================
  // 2. Running Dependency Validation...
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n2. Running Dependency Validation...");

  try {
    new StudioBuilder()
      .withContext(context)
      .withRuntime(mRuntime)
      // missing host!
      .withBootstrapper(mBootstrapper)
      .withKernel(mKernel)
      .withConfiguration(mConfiguration)
      .withSecurity(mSecurity)
      .withObservability(mObservability)
      .withStorage(mStorage)
      .withScheduler(mScheduler)
      .build();
    throw new Error("Should have rejected missing host dependency");
  } catch (err: unknown) {
    assert(
      err instanceof StudioValidationException,
      "Expected StudioValidationException for missing dependency"
    );
  }
  // eslint-disable-next-line no-console
  console.log("✓ Verified dependency validation.");

  // ==========================================
  // 3. Running Composition Validation...
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n3. Running Composition Validation...");
  
  assert(studio.runtime === mRuntime, "Runtime reference matches");
  assert(studio.host === mHost, "Host reference matches");
  assert(studio.bootstrapper === mBootstrapper, "Bootstrapper reference matches");
  assert(studio.kernel === mKernel, "Kernel reference matches");
  assert(studio.configuration === mConfiguration, "Configuration reference matches");
  assert(studio.security === mSecurity, "Security reference matches");
  assert(studio.observability === mObservability, "Observability reference matches");
  assert(studio.storage === mStorage, "Storage reference matches");
  assert(studio.scheduler === mScheduler, "Scheduler reference matches");

  // eslint-disable-next-line no-console
  console.log("✓ Verified composition root.");

  // ==========================================
  // 4. Running Lifecycle Validation...
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n4. Running Lifecycle Validation...");

  const lifeStudio = new StudioBuilder()
    .withContext(context)
    .withRuntime(mRuntime)
    .withHost(mHost)
    .withBootstrapper(mBootstrapper)
    .withKernel(mKernel)
    .withConfiguration(mConfiguration)
    .withSecurity(mSecurity)
    .withObservability(mObservability)
    .withStorage(mStorage)
    .withScheduler(mScheduler)
    .build();

  // Illegal start before initialize
  try {
    await lifeStudio.start();
    throw new Error("Should have prevented start before initialize");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidStudioStateException,
      "Expected InvalidStudioStateException for early start"
    );
  }

  // Proper sequence
  await lifeStudio.initialize();
  await lifeStudio.start();
  await lifeStudio.stop();

  // eslint-disable-next-line no-console
  console.log("✓ Verified initialize/start/stop transitions.");

  // ==========================================
  // 5. Running Startup Ordering...
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n5. Running Startup Ordering...");
  
  executionOrder.length = 0; // reset
  const orderStudio = new StudioBuilder()
    .withContext(context)
    .withRuntime(mRuntime)
    .withHost(mHost)
    .withBootstrapper(mBootstrapper)
    .withKernel(mKernel)
    .withConfiguration(mConfiguration)
    .withSecurity(mSecurity)
    .withObservability(mObservability)
    .withStorage(mStorage)
    .withScheduler(mScheduler)
    .build();

  await orderStudio.initialize();
  await orderStudio.start();

  assert(executionOrder[0] === "runtime_init", "Runtime initializes first");
  assert(executionOrder[1] === "runtime_start", "Runtime starts second");

  // eslint-disable-next-line no-console
  console.log("✓ Verified Runtime ownership chain.");

  // ==========================================
  // 6. Running Shutdown Ordering...
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n6. Running Shutdown Ordering...");
  
  executionOrder.length = 0; // reset
  await orderStudio.stop();

  assert(executionOrder[0] === "runtime_stop", "Runtime stops first");

  // eslint-disable-next-line no-console
  console.log("✓ Verified reverse shutdown ordering.");

  // ==========================================
  // 7. Running Snapshot Immutability Validation...
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n7. Running Snapshot Immutability Validation...");

  const snapStudio = new StudioBuilder()
    .withContext(context)
    .withRuntime(mRuntime)
    .withHost(mHost)
    .withBootstrapper(mBootstrapper)
    .withKernel(mKernel)
    .withConfiguration(mConfiguration)
    .withSecurity(mSecurity)
    .withObservability(mObservability)
    .withStorage(mStorage)
    .withScheduler(mScheduler)
    .build();

  await snapStudio.initialize();
  await snapStudio.start();

  const snapshot = snapStudio.snapshot();

  // Snapshot freeze verification
  try {
    (snapshot as any).state = StudioState.FAILED;
    throw new Error("Should have frozen snapshot root");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Expected TypeError on modifying snapshot root");
  }

  try {
    (snapshot.registeredFrameworks as any)[0] = "hacked";
    throw new Error("Should have frozen snapshot registeredFrameworks");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Expected TypeError on modifying registeredFrameworks");
  }
  // eslint-disable-next-line no-console
  console.log("✓ Verified deep freeze immutability.");

  // ==========================================
  // 8. Running Validator Rule Checks...
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n8. Running Validator Rule Checks...");

  // Identifier space validation
  try {
    StudioValidator.validateIdentifier("invalid id space", "Context ID");
    throw new Error("Should have failed space check");
  } catch (err: unknown) {
    assert(
      err instanceof StudioValidationException,
      "Expected StudioValidationException for space check"
    );
  }

  // Identifier symbol validation
  try {
    StudioValidator.validateIdentifier("invalid_id_@_char", "Context ID");
    throw new Error("Should have failed symbol check");
  } catch (err: unknown) {
    assert(
      err instanceof StudioValidationException,
      "Expected StudioValidationException for symbol check"
    );
  }
  // eslint-disable-next-line no-console
  console.log("✓ Verified validator rule constraints.");

  // eslint-disable-next-line no-console
  console.log("\n=== ALL STUDIO COMPOSITION TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Test execution failed:", err);
  process.exit(1);
});
