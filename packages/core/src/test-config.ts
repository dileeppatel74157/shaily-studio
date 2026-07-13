import { ConfigBuilder } from "./config/ConfigBuilder";
import { ConfigSchema } from "./config/ConfigSchema";
import { EnvironmentSource } from "./config/EnvironmentSource";
import { MemorySource } from "./config/MemorySource";

async function runTests() {
  // eslint-disable-next-line no-console
  console.log("=== START CONFIGURATION MANAGER VERIFICATION TESTS ===");

  // Define schema
  const schema: ConfigSchema = {
    "app.port": { type: "number", required: true },
    "app.debug": { type: "boolean", default: false },
    "app.env": { type: "enum", required: true, enumValues: ["development", "staging", "production"] },
    "app.title": { type: "string", default: "Shaily Studio Application" },
  };

  // 1. MemorySource and Defaults Tests
  // eslint-disable-next-line no-console
  console.log("1. Running MemorySource & Defaults Validation...");
  const memoryData1 = {
    "app.port": "8080",
    "app.env": "development",
  };

  const builder1 = new ConfigBuilder(schema).withSource(new MemorySource(memoryData1));

  const config = await builder1.build();

  assert(config.get<number>("app.port") === 8080, "Port should be cast to number 8080");
  assert(config.get<boolean>("app.debug") === false, "Debug should fallback to default false");
  assert(config.get<string>("app.env") === "development", "Env enum resolved");
  assert(config.get<string>("app.title") === "Shaily Studio Application", "Title matches default");
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified MemorySource values and default fallback casts.");

  // 2. EnvironmentSource & Source Priority Tests
  // eslint-disable-next-line no-console
  console.log("2. Running EnvironmentSource & Priority Override Validation...");
  process.env.SHAILY_APP_PORT = "9090";
  process.env.SHAILY_APP_DEBUG = "true";
  process.env.SHAILY_APP_ENV = "production";

  const builder2 = new ConfigBuilder(schema)
    .withSource(new MemorySource(memoryData1))
    .withSource(new EnvironmentSource("SHAILY_"));

  const prioritizedConfig = await builder2.build();

  assert(prioritizedConfig.get<number>("app.port") === 9090, "EnvSource should override MemorySource (9090)");
  assert(prioritizedConfig.get<boolean>("app.debug") === true, "EnvSource sets debug to true");
  assert(prioritizedConfig.get<string>("app.env") === "production", "EnvSource overrides env to production");
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified EnvironmentSource parsing and later-source priority overrides.");

  delete process.env.SHAILY_APP_PORT;
  delete process.env.SHAILY_APP_DEBUG;
  delete process.env.SHAILY_APP_ENV;

  // 3. Schema Validation & Casting Error Tests
  // eslint-disable-next-line no-console
  console.log("3. Running Schema Type Casting & Validation Error Checks...");

  try {
    const invalidBuilder = new ConfigBuilder(schema).withSource(new MemorySource({}));
    await invalidBuilder.build();
    throw new Error("Should have thrown validation error for missing required properties");
  } catch (err: any) {
    assert(err.message.includes("is required but was not provided"), "Catches required field error");
    // eslint-disable-next-line no-console
    console.log("   ✓ Prevented empty schema required fields.");
  }

  try {
    const invalidBuilder = new ConfigBuilder(schema).withSource(
      new MemorySource({
        "app.port": "not-a-number",
        "app.env": "development",
      })
    );
    await invalidBuilder.build();
    throw new Error("Should have thrown parsing error for port type mismatch");
  } catch (err: any) {
    assert(err.message.includes("must be a number"), "Catches invalid number error");
    // eslint-disable-next-line no-console
    console.log("   ✓ Caught invalid number type conversions correctly.");
  }

  try {
    const invalidBuilder = new ConfigBuilder(schema).withSource(
      new MemorySource({
        "app.port": 80,
        "app.env": "local",
      })
    );
    await invalidBuilder.build();
    throw new Error("Should have thrown enum validation error");
  } catch (err: any) {
    assert(err.message.includes("must be one of"), "Catches invalid enum selection error");
    // eslint-disable-next-line no-console
    console.log("   ✓ Caught enum constraint validations correctly.");
  }

  // 4. Config Snapshot Immutability Checks
  // eslint-disable-next-line no-console
  console.log("4. Running Snapshot Immutability Validation...");
  const snapshot = config.snapshot();
  assert(snapshot.get<number>("app.port") === 8080, "Snapshot get works");
  assert(snapshot.has("app.env"), "Snapshot has works");

  const record = snapshot.asRecord();
  assert(record["app.port"] === 8080, "asRecord contents match");

  assert(Object.isFrozen(record), "Snapshot record object must be frozen");

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (record as any)["app.port"] = 1111;
    throw new Error("Should have thrown error in strict mode when modifying snapshot properties");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log("   ✓ Prevented external modifications on frozen snapshots correctly.");
  }

  // 5. Dynamic Reloading Tests
  // eslint-disable-next-line no-console
  console.log("5. Running Dynamic Reload Verification...");
  const memorySourceRef = new MemorySource({
    "app.port": 5000,
    "app.env": "staging",
  });

  const reloadableConfig = await new ConfigBuilder(schema).withSource(memorySourceRef).build();
  assert(reloadableConfig.get<number>("app.port") === 5000, "Initial port is 5000");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (memorySourceRef as any)._data["app.port"] = 6000;

  await reloadableConfig.reload();
  assert(reloadableConfig.get<number>("app.port") === 6000, "Port updated to 6000 after reload()");
  // eslint-disable-next-line no-console
  console.log("   ✓ Dynamic reloading re-read underlying sources and validated merged outcomes.");

  // eslint-disable-next-line no-console
  console.log("=== ALL CONFIGURATION MANAGER VERIFICATION TESTS PASSED SUCCESSFULLY ===");
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
