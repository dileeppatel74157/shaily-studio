import { ServiceToken } from "./kernel/ServiceToken";
import { RegistryBuilder } from "./registry/RegistryBuilder";
import { ServiceCollection } from "./registry/ServiceCollection";
import { ServiceLifetime } from "./registry/ServiceLifetime";

// Mock Interfaces
interface Logger {
  log(msg: string): void;
}

interface Database {
  query(sql: string): unknown;
}

interface ServiceA {
  doA(): void;
}

interface ServiceB {
  doB(): void;
}

// Service Tokens
const LOGGER_TOKEN = new ServiceToken<Logger>("logger");
const DATABASE_TOKEN = new ServiceToken<Database>("database");
const SERVICE_A_TOKEN = new ServiceToken<ServiceA>("serviceA");
const SERVICE_B_TOKEN = new ServiceToken<ServiceB>("serviceB");

async function runTests() {
  // eslint-disable-next-line no-console
  console.log("=== START SERVICE REGISTRY VERIFICATION TESTS ===");

  // ==========================================
  // Test 1: Singleton Lifetime Tests
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("1. Running Singleton Lifetime Tests...");
  let dbFactoryCallCount = 0;

  const collection1 = new ServiceCollection()
    .addFactory(
      LOGGER_TOKEN,
      () => ({
        log: (msg: string) => {
          // eslint-disable-next-line no-console
          console.log(`[LOG] ${msg}`);
        },
      }),
      ServiceLifetime.SINGLETON
    )
    .addFactory(
      DATABASE_TOKEN,
      (registry) => {
        dbFactoryCallCount++;
        const logger = registry.resolve(LOGGER_TOKEN);
        logger.log("Database initialized");
        return {
          query: (sql: string) => `Result of "${sql}"`,
        };
      },
      ServiceLifetime.SINGLETON
    );

  const registry = new RegistryBuilder(collection1).build();

  const db1 = registry.resolve(DATABASE_TOKEN);
  const db2 = registry.resolve(DATABASE_TOKEN);

  assert(db1 === db2, "Singleton resolution must return the identical instance");
  assert(dbFactoryCallCount === 1, "Singleton factory should only be invoked once");
  // eslint-disable-next-line no-console
  console.log("   ✓ Singleton caching and factory injection validated.");

  // ==========================================
  // Test 2: Transient Lifetime Tests
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("2. Running Transient Lifetime Tests...");
  let transientCallCount = 0;

  const TRANSIENT_TOKEN = new ServiceToken<{ id: number }>("transientService");

  const collection2 = new ServiceCollection().addFactory(
    TRANSIENT_TOKEN,
    () => {
      transientCallCount++;
      return { id: transientCallCount };
    },
    ServiceLifetime.TRANSIENT
  );

  const transientRegistry = new RegistryBuilder(collection2).build();

  const t1 = transientRegistry.resolve(TRANSIENT_TOKEN);
  const t2 = transientRegistry.resolve(TRANSIENT_TOKEN);

  assert(t1 !== t2, "Transient resolution must return new instances");
  assert(t1.id === 1 && t2.id === 2, "Transient factory invoked on every resolution");
  // eslint-disable-next-line no-console
  console.log("   ✓ Transient instantiation validated.");

  // ==========================================
  // Test 3: Duplicate Registration Guard Tests
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("3. Running Duplicate Registration Guard Tests...");
  try {
    new RegistryBuilder(
      new ServiceCollection()
        .add(LOGGER_TOKEN, { log: () => {} })
        .add(LOGGER_TOKEN, { log: () => {} })
    ).build();
    throw new Error("Should have thrown error on double registration");
  } catch (err: any) {
    assert(err.message.includes("already been registered"), "Prevented duplicate token registrations");
    // eslint-disable-next-line no-console
    console.log("   ✓ Prevented duplicate registration correctly.");
  }

  // ==========================================
  // Test 4: Circular Dependency Detection Tests
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("4. Running Circular Dependency Detection Tests...");

  const cycleCollection = new ServiceCollection()
    .addFactory(SERVICE_A_TOKEN, (reg) => {
      const b = reg.resolve(SERVICE_B_TOKEN);
      return { doA: () => b.doB() };
    })
    .addFactory(SERVICE_B_TOKEN, (reg) => {
      const a = reg.resolve(SERVICE_A_TOKEN);
      return { doB: () => a.doA() };
    });

  const cycleRegistry = new RegistryBuilder(cycleCollection).build();

  try {
    cycleRegistry.resolve(SERVICE_A_TOKEN);
    throw new Error("Should have thrown error for circular dependency");
  } catch (err: any) {
    assert(err.message.includes("Circular dependency detected"), "Circular trap caught dependencies");
    assert(err.message.includes("serviceA -> serviceB -> serviceA"), "Circular error lists correct dependency path");
    // eslint-disable-next-line no-console
    console.log("   ✓ Circular dependency cycle detected correctly: " + err.message);
  }

  // ==========================================
  // Test 5: Snapshot & Immutability Tests
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("5. Running Snapshot & Immutability Tests...");
  const snap = registry.snapshot();

  assert(snap.registrations.length === 2, "Snapshot registrations exist");
  assert(snap.registrations[0].lifetime === ServiceLifetime.SINGLETON, "Correct lifetime in snapshot");
  assert(snap.registrations[0].isResolved === true, "Resolved singleton status correctly flagged");

  assert(Object.isFrozen(snap), "Registry snapshot must be frozen");
  assert(Object.isFrozen(snap.registrations), "Registrations metadata array must be frozen");

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (snap as any).registrations = [];
    throw new Error("Should have thrown error in strict mode when modifying snapshot properties");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log("   ✓ Snapshot immutability enforced successfully.");
  }

  // eslint-disable-next-line no-console
  console.log("=== ALL SERVICE REGISTRY VERIFICATION TESTS PASSED SUCCESSFULLY ===");
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
