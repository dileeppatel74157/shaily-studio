import * as fs from "fs";
import * as path from "path";
import {
  RuntimeEngine,
  LoggerBuilder,
  ConsoleTransport,
  JsonFormatter,
  EventBus,
  MemoryStore,
  ServiceRegistry,
  ConfigBuilder,
  DatabaseEngine
} from "@shaily/core/api-gateway";
import { GatewayBuilder } from "./gateway/GatewayBuilder";
import { GatewayContext } from "./gateway/GatewayContext";
console.log("[Diagnostic] STARTUP: process.env.PORT =", process.env.PORT);
const originalPort = process.env.PORT;
// Native .env file loader for Node 22 or fallback
try {
  if (typeof (process as any).loadEnvFile === "function") {
    (process as any).loadEnvFile();
  } else {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const idx = trimmed.indexOf("=");
          if (idx !== -1) {
            const key = trimmed.substring(0, idx).trim();
            const val = trimmed.substring(idx + 1).trim().replace(/^['"]|['"]$/g, "");
            process.env[key] = val;
          }
        }
      }
    }
  }
} catch (_) { }

console.log("[Diagnostic] AFTER LOAD: process.env.PORT =", process.env.PORT);

if (originalPort !== undefined) {
  process.env.PORT = originalPort;
}

console.log("[Diagnostic] RESTORED: process.env.PORT =", process.env.PORT);

async function bootstrap() {
  console.log("[Bootstrap] Starting Shaily Studio API Gateway...");

  // 1. Build context components for RuntimeEngine
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
    env: process.env.NODE_ENV || "development",
    namespace: "shaily-studio",
    logger,
    eventBus,
    memoryStore,
    registry,
    config
  };

  const runtimeConfig = {
    env: process.env.NODE_ENV || "development",
    heartbeatIntervalMs: 5000,
    healthCheckIntervalMs: 10000,
    startupTimeoutMs: 5000,
    shutdownTimeoutMs: 5000,
    metadata: { version: "1.0.0" }
  };

  // 2. Instantiate RuntimeEngine
  console.log("[Bootstrap] Instantiating RuntimeEngine...");
  const runtime = new RuntimeEngine(runtimeContext, runtimeConfig);

  // 3. Initialize DatabaseEngine
  console.log("[Bootstrap] Initializing DatabaseEngine...");
  const dbEngine = runtime.getEngine<DatabaseEngine>("DatabaseEngine");
  await dbEngine.initialize();
  await dbEngine.connect();
  console.log("[Bootstrap] DatabaseEngine connected. Running schema verification...");

  // Verify Schema: Check that key tables exist
  try {
    const qm = dbEngine.getQueryManager();
    await qm.execute({ id: "verify-migrations", sql: "SELECT * FROM _migrations LIMIT 1" });
    await qm.execute({ id: "verify-tasks", sql: "SELECT * FROM tasks LIMIT 1" });
    await qm.execute({ id: "verify-channels", sql: "SELECT * FROM channel_connections LIMIT 1" });
    await qm.execute({ id: "verify-credentials", sql: "SELECT * FROM oauth_credentials LIMIT 1" });
    console.log("[Bootstrap] Schema verified successfully.");
  } catch (err: any) {
    console.error("[Bootstrap] Schema verification failed:", err.message);
    throw new Error(`Schema verification failed: ${err.message}`);
  }

  // 4. Initialize RuntimeEngine (initializes all other registered engines)
  console.log("[Bootstrap] Initializing RuntimeEngine...");
  await runtime.initialize();

  console.log("[Bootstrap] Starting RuntimeEngine...");
  await runtime.start();

  // 5. Build GatewayContext
  console.log("[Bootstrap] Building GatewayContext...");
  const gatewayContext: GatewayContext = {
    logger,
    orchestrator: runtime.getEngine<any>("OrchestratorEngine"),
    router: runtime.getEngine<any>("RouterEngine"),
    providers: runtime.getEngine<any>("LLMProviderEngine"),
    agents: runtime.getEngine<any>("AgentRegistry"),
    workflow: runtime.getEngine<any>("WorkflowEngine"),
    tools: runtime.getEngine<any>("ToolRegistry"),
    prompts: runtime.getEngine<any>("PromptRegistry"),
    knowledge: runtime.getEngine<any>("KnowledgeBaseEngine"),
    rag: runtime.getEngine<any>("RAGEngine"),
    plugins: runtime.getEngine<any>("PluginRegistry"),
    mcp: runtime.getEngine<any>("MCPServer"),
    metadata: { version: "1.0.0", env: process.env.NODE_ENV || "development" }
  };
  (gatewayContext as any).databaseEngine = dbEngine;
  (gatewayContext as any).channelManager = runtime.getEngine<any>("ChannelManagerEngine");
  (gatewayContext as any).memoryEngine = runtime.getEngine<any>("MemoryEngine");
  (gatewayContext as any).observabilityEngine = runtime.getEngine<any>("ObservabilityEngine");

  // 6. Build and start Gateway
  const host = process.env.HOST || "0.0.0.0";
  const port = parseInt(process.env.PORT || "8000", 10);
  console.log(`[Bootstrap] Creating Gateway on ${host}:${port}...`);
  const gateway = new GatewayBuilder()
    .withContext(gatewayContext)
    .withHost(host)
    .withPort(port)
    .build();

  console.log("[Bootstrap] Initializing Gateway...");
  await gateway.initialize();

  console.log("[Bootstrap] Starting Gateway...");
  await gateway.start();

  console.log(`[Bootstrap] Shaily Studio Node API Gateway is running on http://${host}:${port}`);
}

bootstrap().catch(err => {
  console.error("[Bootstrap] Bootstrapping failed:", err);
  process.exit(1);
});
