import { CompositionBuilder } from "./composition/CompositionBuilder";
import { CompositionContext } from "./composition/CompositionContext";
import { DependencyContainer } from "./composition/DependencyContainer";
import { ServiceLifetime } from "./composition/ServiceLifetime";
import { CompositionValidator } from "./composition/CompositionValidator";
import {
  CompositionValidationException,
  CircularDependencyException,
  InvalidCompositionStateException,
} from "./composition/types";
import { IBootstrapper } from "./bootstrap/IBootstrapper";

function assert(condition: boolean, message: string) {
  if (!condition) {
    // eslint-disable-next-line no-console
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

// Test Helper Classes
class Counter {
  public static count = 0;
  public readonly id: number;
  constructor() {
    Counter.count++;
    this.id = Counter.count;
  }
}

class DependencyA {
  constructor() {}
}

class DependencyB {
  public static readonly inject = ["DependencyA"];
  constructor(public readonly depA: DependencyA) {}
}

class CircularA {
  public static readonly inject = ["CircularB"];
  constructor(public readonly circularB: any) {}
}

class CircularB {
  public static readonly inject = ["CircularA"];
  constructor(public readonly circularA: any) {}
}

async function runTests() {
  // eslint-disable-next-line no-console
  console.log("=== START DI & COMPOSITION TESTS ===");

  const context: CompositionContext = {
    env: "test",
    namespace: "shaily.composition",
    metadata: { version: "1.0.0" },
  };

  // ==========================================
  // 1. Builder Validation
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("1. Running Builder Validation...");
  try {
    new CompositionBuilder().build();
    throw new Error("Should have rejected missing context");
  } catch (err: unknown) {
    assert(
      err instanceof CompositionValidationException,
      "Expected CompositionValidationException for missing context"
    );
  }
  // eslint-disable-next-line no-console
  console.log("✓ Verified Builder Validation.");

  // ==========================================
  // 2. Service Registration & 8. Duplicate Registration
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n2 & 8. Running Service Registration & Duplicate Registration checks...");
  const container = new DependencyContainer();
  container.addSingleton("Counter", Counter);
  
  try {
    container.addSingleton("Counter", Counter);
    throw new Error("Should have rejected duplicate registration");
  } catch (err: unknown) {
    assert(
      err instanceof CompositionValidationException,
      "Expected CompositionValidationException on duplicate token registration"
    );
  }
  // eslint-disable-next-line no-console
  console.log("✓ Verified registration checks.");

  // ==========================================
  // 3. Singleton Resolution
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n3. Running Singleton Resolution checks...");
  Counter.count = 0;
  const singleContainer = new DependencyContainer();
  singleContainer.addSingleton("Counter", Counter);
  const singleProvider = singleContainer.build();

  const s1 = singleProvider.resolve<Counter>("Counter");
  const s2 = singleProvider.resolve<Counter>("Counter");
  assert(s1.id === s2.id, "Singleton instances must match");
  assert(Counter.count === 1, "Singleton constructor should only be called once");
  // eslint-disable-next-line no-console
  console.log("✓ Verified Singleton Resolution.");

  // ==========================================
  // 4. Scoped Resolution
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n4. Running Scoped Resolution checks...");
  Counter.count = 0;
  const scopedContainer = new DependencyContainer();
  scopedContainer.addScoped("Counter", Counter);
  const rootProvider = scopedContainer.build();

  const scope1 = rootProvider.createScope();
  const scope2 = rootProvider.createScope();

  const sc1 = scope1.resolve<Counter>("Counter");
  const sc2 = scope1.resolve<Counter>("Counter");
  assert(sc1.id === sc2.id, "Scoped instances in same scope must match");

  const sc3 = scope2.resolve<Counter>("Counter");
  assert(sc1.id !== sc3.id, "Scoped instances in different scopes must be separate");
  assert(Counter.count === 2, "Scoped constructor should be called once per scope");
  // eslint-disable-next-line no-console
  console.log("✓ Verified Scoped Resolution.");

  // ==========================================
  // 5. Transient Resolution
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n5. Running Transient Resolution checks...");
  Counter.count = 0;
  const transientContainer = new DependencyContainer();
  transientContainer.addTransient("Counter", Counter);
  const transientProvider = transientContainer.build();

  const t1 = transientProvider.resolve<Counter>("Counter");
  const t2 = transientProvider.resolve<Counter>("Counter");
  assert(t1.id !== t2.id, "Transient instances must never match");
  assert(Counter.count === 2, "Transient constructor should be called on every resolution");
  // eslint-disable-next-line no-console
  console.log("✓ Verified Transient Resolution.");

  // ==========================================
  // 6. Constructor Parameter Injection
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n6. Running Constructor Injection checks...");
  const injectContainer = new DependencyContainer();
  injectContainer.addSingleton("DependencyA", DependencyA);
  injectContainer.addSingleton("DependencyB", DependencyB);
  const injectProvider = injectContainer.build();

  const depB = injectProvider.resolve<DependencyB>("DependencyB");
  assert(depB instanceof DependencyB, "Resolved object must match target type");
  assert(depB.depA instanceof DependencyA, "Resolved object's dependencies must be injected");
  // eslint-disable-next-line no-console
  console.log("✓ Verified Constructor Parameter Injection.");

  // ==========================================
  // 7. Circular Dependency Detection
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n7. Running Circular Dependency checks...");
  // Test static check during build
  try {
    const circContainer = new DependencyContainer();
    circContainer.addSingleton("CircularA", CircularA);
    circContainer.addSingleton("CircularB", CircularB);
    circContainer.build();
    throw new Error("Should have thrown on circular dependency during build");
  } catch (err: unknown) {
    assert(
      err instanceof CompositionValidationException,
      "Expected CompositionValidationException for static circular dependency"
    );
  }

  // Test dynamic check during resolve
  try {
    const dynContainer = new DependencyContainer();
    // Bypass static checker using factories that call each other
    dynContainer.addSingleton("A", null, (p) => p.resolve("B"));
    dynContainer.addSingleton("B", null, (p) => p.resolve("A"));
    const dynProvider = dynContainer.build();
    dynProvider.resolve("A");
    throw new Error("Should have thrown CircularDependencyException during resolve");
  } catch (err: any) {
    console.log("Dynamically caught error details:", err.constructor.name, err.message, err instanceof CircularDependencyException);
    assert(
      err instanceof CircularDependencyException,
      "Expected CircularDependencyException for dynamic circular dependency"
    );
  }

  // eslint-disable-next-line no-console
  console.log("✓ Verified Circular Dependency Detection.");

  // ==========================================
  // 9. Snapshot Immutability
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n9. Running Snapshot Immutability checks...");
  const snapContainer = new DependencyContainer();
  snapContainer.addSingleton("Counter", Counter);
  const snapProvider = snapContainer.build();
  const snapshot = snapProvider.snapshot();

  try {
    (snapshot as any).singletonCount = 999;
    throw new Error("Should have rejected snapshot mutation");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Expected TypeError on modifying frozen snapshot root");
  }

  try {
    (snapshot.dependencyGraph as any)["Counter"] = ["hacked"];
    throw new Error("Should have rejected graph mutation");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Expected TypeError on modifying frozen dependencyGraph");
  }
  // eslint-disable-next-line no-console
  console.log("✓ Verified Snapshot Immutability.");

  // ==========================================
  // 10. Validator Rule Checks
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n10. Running Validator Rule Checks...");
  try {
    CompositionValidator.validateIdentifier("invalid namespace space", "Namespace");
    throw new Error("Should have rejected spaces in identifier");
  } catch (err: unknown) {
    assert(
      err instanceof CompositionValidationException,
      "Expected CompositionValidationException for namespace space check"
    );
  }

  try {
    CompositionValidator.validateIdentifier("invalid_namespace_@_char", "Namespace");
    throw new Error("Should have rejected symbol characters in identifier");
  } catch (err: unknown) {
    assert(
      err instanceof CompositionValidationException,
      "Expected CompositionValidationException for symbol character check"
    );
  }
  // eslint-disable-next-line no-console
  console.log("✓ Verified Validator Rule Checks.");

  // ==========================================
  // 11. Complete Studio Composition & 12. Lifecycle Validation
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n11 & 12. Running Complete Studio Composition & Lifecycle Validation...");
  const compositionRoot = new CompositionBuilder()
    .withContext(context)
    .withMetadata({ author: "Antigravity" })
    .build();

  assert(compositionRoot.state === "CREATED", "Initial state must be CREATED");

  // Illegal transition check: start before initialize
  try {
    await compositionRoot.start();
    throw new Error("Should have prevented start before initialize");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidCompositionStateException,
      "Expected InvalidCompositionStateException for early start"
    );
  }

  // Proper lifecycle sequence
  await compositionRoot.initialize();
  assert(compositionRoot.state === "READY", "State must be READY after initialize");

  // Load a default empty manifest prior to starting to avoid validation errors
  const bootstrapper = compositionRoot.provider.resolve<IBootstrapper>("IBootstrapper");
  await bootstrapper.loadManifest({
    version: "1.0.0",
    modules: [],
  });

  await compositionRoot.start();
  assert(compositionRoot.state === "RUNNING", "State must be RUNNING after start");


  // Snapshot during running state
  const compSnap = compositionRoot.snapshot();
  assert(compSnap.singletonCount > 0, "Singleton count must be populated");
  assert((compSnap.metadata as any).state === "RUNNING", "Metadata state must match RUNNING");

  await compositionRoot.stop();
  assert(compositionRoot.state === "STOPPED", "State must be STOPPED after stop");

  // eslint-disable-next-line no-console
  console.log("✓ Verified Complete Studio Composition & Lifecycle Validation.");

  // eslint-disable-next-line no-console
  console.log("\n=== ALL COMPOSITION FRAMEWORK TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Test execution failed:", err);
  process.exit(1);
});
