import { ConfigurationBuilder } from "./configuration/ConfigurationBuilder";
import { ConfigurationState } from "./configuration/ConfigurationState";
import { ConfigurationScope } from "./configuration/ConfigurationScope";
import { SecretType } from "./configuration/SecretType";
import { ProviderHealth } from "./configuration/ProviderHealth";
import { ValidationResult } from "./configuration/ValidationResult";
import { ConfigurationEventType } from "./configuration/ConfigurationEventType";
import { EnvironmentType } from "./configuration/EnvironmentType";
import { ConfigurationValidationException } from "./configuration/types";
import { ConfigurationValidator } from "./configuration/ConfigurationValidator";
import { RuntimeBuilder } from "./runtime/RuntimeBuilder";
import { SettingsBuilder } from "./settings/SettingsBuilder";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("❌ Assertion Failed:", message);
    process.exit(1);
  }
}

// Mock context
const mockEvents: any[] = [];
const mockContext = {
  logger: {
    info: (msg: string) => {},
    warn: (msg: string) => {},
    error: (msg: string) => {}
  },
  eventBus: {
    publish: async (event: any) => {
      mockEvents.push(event);
    }
  }
};

async function runTests() {
  console.log("=== START SPRINT 23.1 CONFIGURATION ENGINE TESTS ===\n");

  // 1. Builder Validation
  try {
    new ConfigurationBuilder().build();
    assert(false, "Builder should throw if context is missing.");
  } catch (err: any) {
    assert(err instanceof ConfigurationValidationException, "Expected ConfigurationValidationException.");
  }
  console.log("1. Builder Validation... ✓");

  // 2. Environment Loading
  const engine = new ConfigurationBuilder().withContext(mockContext).build();
  assert(engine.getState() === ConfigurationState.CREATED, "Engine state should be CREATED.");
  
  await engine.initialize();
  assert(engine.getState() === ConfigurationState.READY, "Engine state should be READY.");
  
  const env = engine.getEnvironmentManager().getEnvironment();
  assert(env.envType === EnvironmentType.PRODUCTION, "Expected PRODUCTION environment type.");
  assert(env.variables["PORT"] === "8000", "Expected PORT variable to be 8000.");
  console.log("2. Environment Loading... ✓");

  // 3. Secret Loading
  const secrets = engine.getSecretsManager().getSecrets();
  assert(secrets.length === 2, "Expected 2 loaded secrets.");
  assert(secrets.some(s => s.key === "OPENAI_API_KEY"), "OpenAI API key missing.");
  console.log("3. Secret Loading... ✓");

  // 4. Secret Encryption
  const secretsMgr = engine.getSecretsManager();
  const encrypted = await secretsMgr.encryptSecret("my-secret-key-value-123");
  assert(encrypted.startsWith("enc-"), "Encrypted secret should start with enc-.");
  console.log("4. Secret Encryption... ✓");

  // 5. Secret Decryption
  const decrypted = await secretsMgr.decryptSecret(encrypted);
  assert(decrypted === "my-secret-key-value-123", "Decrypted secret does not match plain text.");
  console.log("5. Secret Decryption... ✓");

  // 6. Configuration Validation
  const report = await engine.getValidator().validate(engine.getSnapshot());
  assert(report.result === ValidationResult.PASSED, "Validation report should pass.");
  console.log("6. Configuration Validation... ✓");

  // 7. Provider Configuration
  const provMgr = engine.getProviderManager();
  const openaiProv = provMgr.getProviderConfiguration("openai");
  assert(openaiProv !== undefined, "OpenAI provider config must exist.");
  assert(openaiProv!.enabled, "OpenAI provider should be enabled by default.");
  assert(openaiProv!.timeoutMs === 15000, "Expected OpenAI timeout to be 15000.");
  console.log("7. Provider Configuration... ✓");

  // 8. Health Check
  const healthReports = await engine.getHealthChecker().checkHealth();
  assert(healthReports.length === 2, "Expected 2 provider health check reports.");
  assert(healthReports.some(h => h.providerId === "openai" && h.status === ProviderHealth.ONLINE), "OpenAI should be ONLINE.");
  console.log("8. Health Check... ✓");

  // 9. Runtime Distribution
  let distributed = false;
  engine.getDistributor().registerListener((config) => {
    distributed = true;
  });
  await engine.getDistributor().distributeConfiguration();
  assert(distributed, "Configuration distribution listener not triggered.");
  console.log("9. Runtime Distribution... ✓");

  // 10. Workspace Distribution
  const envMgr = engine.getEnvironmentManager();
  assert(envMgr.resolveVariable("DATABASE_URL") !== undefined, "Workspace database URL missing.");
  console.log("10. Workspace Distribution... ✓");

  // 11. Settings Integration
  // Setup SettingsEngine and link configurations
  const settingsEngine = new SettingsBuilder()
    .withContext(mockContext)
    .build();
  await settingsEngine.initialize();
  assert(settingsEngine.getConfigurationManager().getConfiguration().version === "1.0.0", "Settings version mismatch.");
  console.log("11. Settings Integration... ✓");

  // 12. Runtime Integration
  // Setup runtime builder and check configurationEngine registration
  const runtimeContext = {
    env: "test",
    namespace: "runtime-config-test",
    startTime: Date.now()
  };
  const runtimeConfig = {
    env: "test",
    heartbeatIntervalMs: 500,
    healthCheckIntervalMs: 1000,
    startupTimeoutMs: 500,
    shutdownTimeoutMs: 500
  };
  const runtime = new RuntimeBuilder()
    .withContext(runtimeContext)
    .withConfig(runtimeConfig)
    .build();

  assert(runtime !== null, "RuntimeEngine builder failed.");
  const configSvc = runtime.getEngine("ConfigurationEngine");
  assert(configSvc !== undefined, "ConfigurationEngine must be registered inside RuntimeEngine.");
  
  // Initialize runtime to trigger system-integration discovery and registration
  await runtime.initialize();
  console.log("12. Runtime Integration... ✓");

  // 13. Assistant Integration
  // Check assistant configuration
  const assistantSvc = runtime.getEngine("AssistantEngine");
  assert(assistantSvc !== undefined, "AssistantEngine should be registered.");
  console.log("13. Assistant Integration... ✓");

  // 14. Pipeline Integration
  // Checks pipeline engine registration
  const integrationSvc = runtime.getEngine("SystemIntegrationEngine");
  const pipelineReg = integrationSvc.getRegistry().getRegistrations().find((r: any) => r.id === "PipelineEngine");
  assert(pipelineReg !== undefined, "PipelineEngine should be registered in SystemIntegrationEngine.");
  console.log("14. Pipeline Integration... ✓");

  // 15. Snapshot Creation
  const snapMgr = engine.getSnapshotManager();
  const snap1 = await snapMgr.createSnapshot();
  assert(snap1 !== undefined, "Snapshot should be created.");
  assert(snapMgr.getSnapshotHistory().length === 2, "Expected 2 snapshots in history.");
  console.log("15. Snapshot Creation... ✓");

  // 16. Configuration Rollback
  const firstSnap = snapMgr.getSnapshotHistory()[0];
  await snapMgr.rollbackToSnapshot(firstSnap.id);
  console.log("16. Configuration Rollback... ✓");

  // 17. Event Publishing
  const hasConfigLoaded = mockEvents.some(e => e.name === "CONFIG_LOADED");
  const hasSecretLoaded = mockEvents.some(e => e.name === "SECRET_LOADED");
  assert(hasConfigLoaded && hasSecretLoaded, "Required events not published.");
  console.log("17. Event Publishing... ✓");

  // 18. Snapshot Immutability
  const snap = engine.getSnapshot();
  assert(Object.isFrozen(snap), "Snapshot should be frozen.");
  assert(Object.isFrozen(snap.environment), "Snapshot environment should be frozen.");
  console.log("18. Snapshot Immutability... ✓");

  // 19. Validator Rules
  try {
    new ConfigurationValidator().validateApiKeyFormat("openai", "bad-key-value");
    assert(false, "Should have thrown for invalid OpenAI API Key format.");
  } catch (err: any) {
    assert(err instanceof ConfigurationValidationException, "Expected ConfigurationValidationException.");
  }
  console.log("19. Validator Rules... ✓");

  // 20. Complete End-to-End Configuration Lifecycle
  const freshEngine = new ConfigurationBuilder().withContext(mockContext).build();
  await freshEngine.initialize();
  await freshEngine.start();
  
  const originalHistoryLength = freshEngine.getSnapshotManager().getSnapshotHistory().length;
  await freshEngine.getSnapshotManager().createSnapshot();
  assert(freshEngine.getSnapshotManager().getSnapshotHistory().length === originalHistoryLength + 1, "E2E snapshot creation failed.");
  
  await freshEngine.stop();
  console.log("20. Complete End-to-End Configuration Lifecycle... ✓\n");

  console.log("=== ALL 20/20 CONFIGURATION ENGINE TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch(err => {
  console.error("Test suite threw an exception:", err);
  process.exit(1);
});
