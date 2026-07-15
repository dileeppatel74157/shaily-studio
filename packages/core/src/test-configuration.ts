import { ConfigurationBuilder } from "./configuration/ConfigurationBuilder";
import { ConfigurationContext } from "./configuration/ConfigurationContext";
import { ConfigurationSchema } from "./configuration/ConfigurationSchema";
import { MemoryConfigurationProvider } from "./configuration/ConfigurationProvider";
import { ConfigurationState } from "./configuration/ConfigurationState";
import { ConfigurationValidator } from "./configuration/ConfigurationValidator";
import { ConfigurationChange } from "./configuration/ConfigurationChange";
import {
  ConfigurationException,
  ConfigurationValidationException,
  InvalidConfigurationStateException,
} from "./configuration/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    // eslint-disable-next-line no-console
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

async function runTests() {
  // eslint-disable-next-line no-console
  console.log("=== START CONFIGURATION FRAMEWORK VERIFICATION TESTS ===");

  const context: ConfigurationContext = {
    env: "development",
    namespace: "studio",
    metadata: { version: "1.0.0" },
  };

  const schema: ConfigurationSchema = {
    "app.port": { type: "number", required: true, default: 8080 },
    "app.name": { type: "string", required: true },
    "app.debug": { type: "boolean", required: false, default: false },
    "app.env": {
      type: "enum",
      required: true,
      enumValues: ["development", "staging", "production"],
    },
  };

  // ==========================================
  // 1. Builder Validation
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("1. Running Builder Validation...");

  // Valid construction
  const provider1 = new MemoryConfigurationProvider("defaults", 10, {
    "app.name": "Shaily Studio",
    "app.env": "development",
  });

  const config = new ConfigurationBuilder()
    .withContext(context)
    .withSchema(schema)
    .withProvider(provider1)
    .withMetadata({ build: "dev-45" })
    .build();

  assert(config !== null, "Configuration must be successfully constructed");

  // Invalid construction (missing context)
  try {
    new ConfigurationBuilder().withSchema(schema).build();
    throw new Error("Should have rejected build with missing context");
  } catch (err: unknown) {
    assert(
      err instanceof ConfigurationValidationException,
      "Expected ConfigurationValidationException for missing context"
    );
  }

  // Invalid construction (missing schema)
  try {
    new ConfigurationBuilder().withContext(context).build();
    throw new Error("Should have rejected build with missing schema");
  } catch (err: unknown) {
    assert(
      err instanceof ConfigurationValidationException,
      "Expected ConfigurationValidationException for missing schema"
    );
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified Builder Validation.");

  // ==========================================
  // 2. Lifecycle State Transitions
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("2. Running Lifecycle Transition Validation...");

  const testConfig = new ConfigurationBuilder()
    .withContext(context)
    .withSchema(schema)
    .withProvider(provider1)
    .build();

  // Try calling runtime operation in CREATED state
  try {
    testConfig.get("app.port");
    throw new Error("Should have prevented get in CREATED state");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidConfigurationStateException,
      "Expected InvalidConfigurationStateException for CREATED state"
    );
  }

  // CREATED -> READY
  await testConfig.initialize();

  // Try illegal transition READY -> STOPPED
  try {
    await testConfig.stop();
    throw new Error("Should have prevented READY -> STOPPED");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidConfigurationStateException,
      "Expected InvalidConfigurationStateException for READY -> STOPPED"
    );
  }

  // READY -> RUNNING
  await testConfig.start();

  // Try illegal transition RUNNING -> READY
  try {
    await testConfig.initialize();
    throw new Error("Should have prevented RUNNING -> READY");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidConfigurationStateException,
      "Expected InvalidConfigurationStateException for RUNNING -> READY"
    );
  }

  // RUNNING -> STOPPED
  await testConfig.stop();

  // Once stopped, operations must fail
  try {
    testConfig.get("app.port");
    throw new Error("Should have prevented get in STOPPED state");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidConfigurationStateException,
      "Expected InvalidConfigurationStateException for STOPPED state"
    );
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified Lifecycle State Transition and exception rules.");

  // ==========================================
  // 3. Schema & Required & Defaults Validation
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("3. Running Schema Validation, Defaults, and Required values...");

  const activeConfig = new ConfigurationBuilder()
    .withContext(context)
    .withSchema(schema)
    .withProvider(provider1)
    .build();
  await activeConfig.initialize();
  await activeConfig.start();

  // Check default values
  assert(activeConfig.get<number>("app.port") === 8080, "Default port fallback matches");
  assert(activeConfig.get<boolean>("app.debug") === false, "Default debug fallback matches");

  // Check custom loaded value
  assert(activeConfig.get<string>("app.name") === "Shaily Studio", "Custom loaded name matches");

  // Check missing required value trigger during start
  const invalidProvider = new MemoryConfigurationProvider("defaults", 10, {
    "app.env": "development", // app.name is required and missing!
  });
  const faultyConfig = new ConfigurationBuilder()
    .withContext(context)
    .withSchema(schema)
    .withProvider(invalidProvider)
    .build();
  await faultyConfig.initialize();
  try {
    await faultyConfig.start();
    throw new Error("Should have rejected startup due to missing required key");
  } catch (err: unknown) {
    assert(
      err instanceof ConfigurationValidationException,
      "Expected ConfigurationValidationException for missing required key"
    );
  }

  // Check type validation (invalid port type)
  const invalidTypeProvider = new MemoryConfigurationProvider("defaults", 10, {
    "app.name": "Shaily Studio",
    "app.env": "development",
    "app.port": "not-a-number", // should be number!
  });
  const faultyConfig2 = new ConfigurationBuilder()
    .withContext(context)
    .withSchema(schema)
    .withProvider(invalidTypeProvider)
    .build();
  await faultyConfig2.initialize();
  try {
    await faultyConfig2.start();
    throw new Error("Should have rejected startup due to invalid type");
  } catch (err: unknown) {
    assert(
      err instanceof ConfigurationValidationException,
      "Expected ConfigurationValidationException for type mismatch"
    );
  }

  // Check enum boundary validation
  const invalidEnumProvider = new MemoryConfigurationProvider("defaults", 10, {
    "app.name": "Shaily Studio",
    "app.env": "local", // not in develop/staging/prod enums!
  });
  const faultyConfig3 = new ConfigurationBuilder()
    .withContext(context)
    .withSchema(schema)
    .withProvider(invalidEnumProvider)
    .build();
  await faultyConfig3.initialize();
  try {
    await faultyConfig3.start();
    throw new Error("Should have rejected startup due to enum value mismatch");
  } catch (err: unknown) {
    assert(
      err instanceof ConfigurationValidationException,
      "Expected ConfigurationValidationException for enum value mismatch"
    );
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified types, defaults, required keys, and enum rules.");

  // ==========================================
  // 4. Provider Registration & Priorities
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("4. Running Provider Priority & Dynamic Registration...");

  // Register high priority override provider
  const overrideProvider = new MemoryConfigurationProvider("overrides", 50, {
    "app.port": 9090, // override default 8080
    "app.name": "Shaily Override",
  });

  await activeConfig.registerProvider(overrideProvider);

  // Check override values applied
  assert(activeConfig.get<number>("app.port") === 9090, "Override port should be 9090");
  assert(activeConfig.get<string>("app.name") === "Shaily Override", "Override name matches");

  // Check duplicate provider registration block
  try {
    await activeConfig.registerProvider(overrideProvider);
    throw new Error("Should have prevented registering duplicate provider");
  } catch (err: unknown) {
    assert(
      err instanceof ConfigurationValidationException,
      "Expected ConfigurationValidationException for duplicate provider"
    );
  }

  // Unregister provider
  await activeConfig.unregisterProvider("overrides");

  // Check fallback occurred back to defaults
  assert(activeConfig.get<number>("app.port") === 8080, "Port fell back to default 8080");
  assert(activeConfig.get<string>("app.name") === "Shaily Studio", "Name fell back to default Shaily Studio");
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified provider priorities and dynamic un/registration.");

  // ==========================================
  // 5. Configuration Get / Set / Has / Remove
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("5. Running Get / Set / Has / Remove operations...");

  assert(activeConfig.has("app.port"), "Should have app.port");
  assert(!activeConfig.has("database.host"), "Should not have database.host");

  // Set override
  await activeConfig.set("app.port", 3000);
  assert(activeConfig.get<number>("app.port") === 3000, "Port set to 3000 dynamically");

  // Remove override
  await activeConfig.remove("app.port");
  assert(activeConfig.get<number>("app.port") === 8080, "Port fell back to default 8080 after removal");
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified basic key-value operations.");

  // ==========================================
  // 6. Runtime Reload
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("6. Running Runtime Reload Validation...");

  // Update backend memory values directly
  provider1.set("app.name", "Shaily Reloaded");
  
  // Before reload, cached value is served
  assert(activeConfig.get<string>("app.name") === "Shaily Studio", "Serving cached value");

  // Reload
  await activeConfig.reload();
  assert(activeConfig.get<string>("app.name") === "Shaily Reloaded", "Reloaded and updated name");
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified caching and manual reloads.");

  // ==========================================
  // 7. Change Watcher Notifications
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("7. Running Change Watcher Notifications...");

  let notifiedChanges: readonly ConfigurationChange[] = [];
  const watcherId = activeConfig.watch((changes) => {
    notifiedChanges = changes;
  });

  await activeConfig.set("app.debug", true);
  assert(notifiedChanges.length === 1, "Received 1 change notification");
  assert(notifiedChanges[0].key === "app.debug", "Changed key matches");
  assert(notifiedChanges[0].oldValue === false, "Old value matches");
  assert(notifiedChanges[0].newValue === true, "New value matches");

  // Unwatch
  activeConfig.unwatch(watcherId);
  notifiedChanges = [];
  await activeConfig.set("app.debug", false);
  assert(notifiedChanges.length === 0, "No notification received after unwatching");
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified watcher subscription and callback triggers.");

  // ==========================================
  // 8. Snapshot Immutability
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("8. Running Snapshot Immutability Validation...");

  const snap = activeConfig.snapshot();

  // Root snapshot
  try {
    (snap as any).timestamp = new Date(0);
    throw new Error("Should have thrown error on modifying snapshot root");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Expected TypeError on modifying frozen snapshot");
  }

  // Snapshot values record
  try {
    (snap.values as any)["app.port"] = 1111;
    throw new Error("Should have thrown error on modifying snapshot values");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Expected TypeError on modifying frozen values");
  }

  // Snapshot sections hierarchy
  assert(snap.sections.length > 0, "Should generate sections");
  const appSection = snap.sections.find((s) => s.path === "app");
  assert(appSection !== undefined, "app section exists");
  assert(appSection!.values.length > 0, "app section values populate");

  try {
    (appSection as any).path = "hack";
    throw new Error("Should have thrown error on modifying snapshot sections");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Expected TypeError on modifying frozen sections");
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified deep freeze immutability on snapshots, values, and sections.");

  // ==========================================
  // 9. Validator Rules
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("9. Running Validator Rule Checks...");

  // Invalid key identifiers
  try {
    ConfigurationValidator.validateIdentifier("invalid key space", "Test key");
    throw new Error("Should have rejected space in key");
  } catch (err: unknown) {
    assert(
      err instanceof ConfigurationValidationException,
      "Expected ConfigurationValidationException for space in key"
    );
  }

  try {
    ConfigurationValidator.validateIdentifier("invalid_@_char", "Test key");
    throw new Error("Should have rejected special symbol in key");
  } catch (err: unknown) {
    assert(
      err instanceof ConfigurationValidationException,
      "Expected ConfigurationValidationException for special symbol in key"
    );
  }

  // Schema format validation (invalid type)
  try {
    const invalidSchema = {
      "app.port": { type: "integer" as any, required: true }, // integer is not valid type!
    };
    ConfigurationValidator.validateSchema(invalidSchema);
    throw new Error("Should have rejected invalid type in schema");
  } catch (err: unknown) {
    assert(
      err instanceof ConfigurationValidationException,
      "Expected ConfigurationValidationException for invalid schema type"
    );
  }

  // Enum validation in schema missing enumValues
  try {
    const invalidSchema = {
      "app.env": { type: "enum" as any, required: true }, // missing enumValues!
    };
    ConfigurationValidator.validateSchema(invalidSchema);
    throw new Error("Should have rejected enum type with missing enumValues");
  } catch (err: unknown) {
    assert(
      err instanceof ConfigurationValidationException,
      "Expected ConfigurationValidationException for missing enum values"
    );
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified schema structures and validator rule constraints.");

  // eslint-disable-next-line no-console
  console.log("=== ALL CONFIGURATION FRAMEWORK VERIFICATION TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Test execution failed:", err);
  process.exit(1);
});
