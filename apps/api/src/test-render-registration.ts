import {
  ServiceRegistry,
  ConfigBuilder,
  LoggerBuilder,
  ConsoleTransport,
  JsonFormatter,
  EventBus,
  MemoryStore,
  RenderEngine,
} from "@shaily/core/api-gateway";
import * as assert from "node:assert";

async function runTargetedRegistrationTest() {
  console.log("=== START TARGETED RENDER ENGINE REGISTRATION TEST ===");

  // 1. Mock context dependencies
  const formatter = new JsonFormatter();
  const logger = new LoggerBuilder()
    .addTransport(new ConsoleTransport(formatter))
    .withFormatter(formatter)
    .build();

  const eventBus = new EventBus(logger);
  const memoryStore = new MemoryStore();
  const registry = new ServiceRegistry();
  const config = await new ConfigBuilder({}).build();

  const runtimeContext = {
    env: "production",
    namespace: "shaily-studio",
    logger,
    eventBus,
    memoryStore,
    registry,
    config,
  };

  // 2. Instantiate, initialize, start, and register RenderEngine (mirrors apps/api/src/index.ts)
  console.log("Initializing RenderEngine...");
  const renderEngine = new RenderEngine(runtimeContext);
  await renderEngine.initialize();
  await renderEngine.start();

  console.log("Registering RenderEngine...");
  registry.register({ name: "IRenderEngine" } as any, renderEngine);

  // 3. Verify resolution from registry
  console.log("Resolving IRenderEngine...");
  const resolved = registry.resolve({ name: "IRenderEngine" } as any);

  assert.ok(resolved !== undefined, "Resolved IRenderEngine should not be undefined");
  assert.strictEqual(resolved, renderEngine, "Resolved IRenderEngine should be the registered instance");
  assert.strictEqual(typeof resolved.render, "function", "Resolved IRenderEngine should expose render method");

  console.log("   ✓ RenderEngine successfully registered and resolved from registry.");
  console.log("=== TARGETED RENDER ENGINE REGISTRATION TEST PASSED ===\n");
}

runTargetedRegistrationTest().catch((err) => {
  console.error("Targeted test failed:", err);
  process.exit(1);
});
