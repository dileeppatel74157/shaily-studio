import { SettingsBuilder } from "./settings/SettingsBuilder";
import { SettingsState } from "./settings/SettingsState";
import { ProviderType } from "./settings/ProviderType";
import { ThemeType } from "./settings/ThemeType";
import { BackupType } from "./settings/BackupType";
import { ImportExportFormat } from "./settings/ImportExportFormat";
import { ConfigurationScope } from "./settings/ConfigurationScope";
import { ValidationSeverity } from "./settings/ValidationSeverity";
import { SettingsValidationException, InvalidSettingsStateException } from "./settings/types";
import { SettingsValidator } from "./settings/SettingsValidator";
import { RuntimeBuilder } from "./runtime/RuntimeBuilder";
import { RuntimeState } from "./runtime/RuntimeState";
import { SettingsConfiguration } from "./settings/models";
import * as fs from "fs";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("❌ Assertion Failed:", message);
    process.exit(1);
  }
}

// Mock contexts
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
  console.log("=== START SPRINT 21.2 SETTINGS ENGINE TESTS ===\n");

  // 1. Builder Validation
  try {
    new SettingsBuilder().build();
    assert(false, "Should have thrown ValidationException when context is missing.");
  } catch (err: any) {
    assert(err instanceof SettingsValidationException, "Expected SettingsValidationException.");
  }
  console.log("1. Builder Validation... ✓");

  // 2. Lifecycle Transitions
  const engine = new SettingsBuilder().withContext(mockContext).build();
  assert(engine.getState() === SettingsState.CREATED, "Engine should start in CREATED state.");
  try {
    await engine.start();
    assert(false, "Should not start without initializing first.");
  } catch (err: any) {
    assert(err instanceof InvalidSettingsStateException, "Expected InvalidSettingsStateException.");
  }
  console.log("2. Lifecycle Transitions... ✓");

  // 3. Settings Load
  await engine.initialize();
  assert(engine.getState() === SettingsState.READY, "Engine should be READY after initialize.");
  console.log("3. Settings Load... ✓");

  // 4. Settings Save
  const configMgr = engine.getConfigurationManager();
  const currentConfig = configMgr.getConfiguration();
  assert(currentConfig.version === "1.0.0", "Expected default version 1.0.0.");
  
  await configMgr.updateConfiguration({ version: "1.0.1" });
  assert(configMgr.getConfiguration().version === "1.0.1", "Version should update to 1.0.1.");
  console.log("4. Settings Save... ✓");

  // 5. API Key Management
  const keyMgr = engine.getApiKeyManager();
  const initialKeysCount = keyMgr.getApiKeys().length;
  await keyMgr.addApiKey(ProviderType.TAVILY, "tavily-mock-api-key");
  assert(keyMgr.getApiKeys().length === initialKeysCount + 1, "API Key should be added.");
  
  const addedKey = keyMgr.getApiKeys().find(k => k.provider === ProviderType.TAVILY);
  assert(addedKey !== undefined, "Tavily API key should exist.");
  assert(addedKey!.value === "tavily-mock-api-key", "Tavily API key value should match.");
  
  await keyMgr.updateApiKey(addedKey!.id, "tavily-updated-key", false);
  const updatedKey = keyMgr.getApiKeys().find(k => k.id === addedKey!.id);
  assert(updatedKey!.value === "tavily-updated-key" && !updatedKey!.enabled, "Key update failed.");
  
  const testRes = await keyMgr.testConnection(ProviderType.TAVILY);
  assert(!testRes.success, "Test connection should fail on disabled key.");

  await keyMgr.removeApiKey(addedKey!.id);
  assert(keyMgr.getApiKeys().find(k => k.id === addedKey!.id) === undefined, "API key was not deleted.");
  console.log("5. API Key Management... ✓");

  // 6. Provider Configuration
  const provMgr = engine.getProviderManager();
  const openaiProv = provMgr.getProvider(ProviderType.OPENAI);
  assert(openaiProv !== undefined, "OpenAI provider config must exist.");
  assert(openaiProv!.enabled, "OpenAI provider should be enabled by default.");
  
  await provMgr.updateProvider(ProviderType.OPENAI, { enabled: false });
  assert(!provMgr.getProvider(ProviderType.OPENAI)!.enabled, "OpenAI provider disable failed.");
  
  // Re-enable
  await provMgr.updateProvider(ProviderType.OPENAI, { enabled: true });
  console.log("6. Provider Configuration... ✓");

  // 7. Model Routing
  const router = engine.getRouter();
  const resolvedProvider = await router.resolveProviderForModel("gpt-4o-mini");
  assert(resolvedProvider === ProviderType.OPENAI, "gpt-4o-mini should resolve to OPENAI provider.");
  
  const geminiResolved = await router.resolveProviderForModel("gemini-1.5-pro");
  assert(geminiResolved === ProviderType.GEMINI, "gemini model should resolve to GEMINI.");
  console.log("7. Model Routing... ✓");

  // 8. GPU Settings
  const gpuMgr = engine.getGPUManager();
  const gpuConfig = gpuMgr.getGPUConfiguration();
  assert(gpuConfig.gpuEnabled, "GPU acceleration should be enabled by default.");
  assert(gpuConfig.batchSize === 4, "Default batchSize should be 4.");
  
  await gpuMgr.updateGPUConfiguration({ batchSize: 8 });
  assert(gpuMgr.getGPUConfiguration().batchSize === 8, "GPU batchSize update failed.");
  
  const hardware = await gpuMgr.detectHardware();
  assert(hardware.hasCuda && hardware.devices.length > 0, "Hardware detection failed.");
  console.log("8. GPU Settings... ✓");

  // 9. Render Settings
  const renderMgr = engine.getRenderManager();
  const renderConfig = renderMgr.getRenderConfiguration();
  assert(renderConfig.resolution === "1920x1080", "Default resolution should be 1920x1080.");
  assert(renderConfig.fps === 30, "Default FPS should be 30.");
  
  await renderMgr.updateRenderConfiguration({ fps: 60 });
  assert(renderMgr.getRenderConfiguration().fps === 60, "Render FPS update failed.");
  console.log("9. Render Settings... ✓");

  // 10. Theme Configuration
  const themeMgr = engine.getThemeManager();
  const themeConfig = themeMgr.getThemeConfiguration();
  assert(themeConfig.theme === ThemeType.DARK, "Default theme should be DARK.");
  
  await themeMgr.updateThemeConfiguration({ theme: ThemeType.CYBERPUNK });
  assert(themeMgr.getThemeConfiguration().theme === ThemeType.CYBERPUNK, "Theme update failed.");
  console.log("10. Theme Configuration... ✓");

  // 11. Backup Creation
  const backupMgr = engine.getBackupManager();
  const backup = await backupMgr.createBackup(BackupType.MANUAL);
  assert(backup.verified, "Backup record should be verified.");
  assert(backupMgr.getBackupHistory().length === 1, "Backup history length should be 1.");
  console.log("11. Backup Creation... ✓");

  // 12. Restore Configuration
  // Modify version, then restore
  await configMgr.updateConfiguration({ version: "2.0.0" });
  assert(configMgr.getConfiguration().version === "2.0.0", "Version update failed before restore.");
  
  await backupMgr.restoreBackup(backup.id);
  assert(configMgr.getConfiguration().version === "1.0.1", "Version should be restored back to 1.0.1.");
  console.log("12. Restore Configuration... ✓");

  // 13. Import Settings
  const importExport = engine.getImportExportManager();
  const newConfig: Partial<SettingsConfiguration> = {
    version: "1.2.0",
    scope: ConfigurationScope.USER,
    apiKeys: [],
    providers: [],
    routingRules: []
  };
  await importExport.importSettings({
    format: ImportExportFormat.JSON,
    payload: JSON.stringify(newConfig),
    scope: ConfigurationScope.USER,
    mergeStrategy: "overwrite"
  });
  assert(configMgr.getConfiguration().version === "1.2.0", "Import failed to load configurations.");
  console.log("13. Import Settings... ✓");

  // 14. Export Settings
  const exported = await importExport.exportSettings({
    format: ImportExportFormat.JSON,
    scope: ConfigurationScope.USER
  });
  const parsedExported = JSON.parse(exported);
  assert(parsedExported.version === "1.2.0", "Export payload does not match.");
  console.log("14. Export Settings... ✓");

  // Reset configuration to restore default workspace/GPU settings
  await engine.getConfigurationManager().resetConfiguration();

  // 15. Runtime Integration
  // Setup runtime and check settingsEngine is initialized
  const runtimeContext = {
    env: "test",
    namespace: "runtime-settings-test",
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
  const settingsSvc = runtime.getEngine("SettingsEngine");
  assert(settingsSvc !== undefined, "SettingsEngine must be registered inside RuntimeEngine.");
  console.log("15. Runtime Integration... ✓");

  // 16. Memory Integration
  // Checks memory fields match
  const memoryConfig = engine.getConfigurationManager().getConfiguration().workspace;
  assert(memoryConfig.autoSaveIntervalMs === 30000, "Workspace auto save interval should be 30s.");
  console.log("16. Memory Integration... ✓");

  // 17. Event Publishing
  const hasLoadedEvt = mockEvents.some(e => e.name === "SettingsLoaded");
  const hasSavedEvt = mockEvents.some(e => e.name === "SettingsSaved");
  assert(hasLoadedEvt && hasSavedEvt, "Required events not emitted.");
  console.log("17. Event Publishing... ✓");

  // 18. Snapshot Immutability
  const snap = engine.getSnapshot();
  assert(Object.isFrozen(snap), "Snapshot object is not frozen.");
  assert(Object.isFrozen(snap.configuration), "Snapshot configuration property is not frozen.");
  try {
    (snap as any).state = SettingsState.FAILED;
    assert(false, "Mutation of snapshot state should have failed.");
  } catch (err: any) {
    // Expected mutation error
  }
  console.log("18. Snapshot Immutability... ✓");

  // 19. Validator Rules
  const invalidConfig = JSON.parse(JSON.stringify(configMgr.getConfiguration()));
  invalidConfig.render.resolution = "invalid-resolution-format";
  invalidConfig.render.fps = -10;
  
  const report = engine.getConfigurationManager().validateConfiguration(); // validate current config (valid)
  assert((await report).isValid, "Current configuration should be valid.");
  
  const invalidReport = new SettingsValidator().validate(invalidConfig);
  assert(!invalidReport.isValid, "Invalid configuration resolution/FPS was not flagged.");
  console.log("19. Validator Rules... ✓");

  // 20. Full End-to-End Settings Lifecycle
  const freshEngine = new SettingsBuilder().withContext(mockContext).build();
  await freshEngine.initialize();
  await freshEngine.start();
  
  // Modify theme, verify event
  const eventsBefore = mockEvents.length;
  await freshEngine.getThemeManager().updateThemeConfiguration({ theme: ThemeType.LIGHT });
  assert(freshEngine.getThemeManager().getThemeConfiguration().theme === ThemeType.LIGHT, "E2E theme toggle failed.");
  assert(mockEvents.length > eventsBefore, "E2E theme change event not published.");

  await freshEngine.stop();
  console.log("20. Full End-to-End Settings Lifecycle... ✓\n");

  console.log("=== ALL 20/20 SETTINGS ENGINE TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
