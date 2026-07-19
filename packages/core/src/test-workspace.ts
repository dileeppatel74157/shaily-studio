import { WorkspaceBuilder } from "./workspace/WorkspaceBuilder";
import { WorkspaceEngine } from "./workspace/WorkspaceEngine";
import { WorkspaceState } from "./workspace/WorkspaceState";
import { ProjectState } from "./workspace/ProjectState";
import { AssetCategory } from "./workspace/AssetCategory";
import { AssetStatus } from "./workspace/AssetStatus";
import { VersionState } from "./workspace/VersionState";
import { BackupState } from "./workspace/BackupState";
import { SearchType } from "./workspace/SearchType";
import { StorageProvider } from "./workspace/StorageProvider";
import { WorkspaceValidator } from "./workspace/WorkspaceValidator";
import {
  WorkspaceValidationException,
  InvalidWorkspaceStateException,
  VersionException,
  BackupException,
  RestoreException
} from "./workspace/types";
import { RuntimeBuilder } from "./runtime/RuntimeBuilder";
import { StartupPriority } from "./runtime/StartupPriority";
import { RuntimeState } from "./runtime/RuntimeState";

function assert(condition: boolean, message: string) {
  if (!condition) {
    // eslint-disable-next-line no-console
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

// Mock Memory Store implementation
class MockMemoryStore {
  public store = new Map<string, Map<string, any>>();

  public async set(namespace: string, key: string, value: any): Promise<any> {
    if (!this.store.has(namespace)) {
      this.store.set(namespace, new Map());
    }
    this.store.get(namespace)!.set(key, value);
    return { namespace, key, value, timestamp: new Date() };
  }

  public async get(namespace: string, key: string): Promise<any> {
    return this.store.get(namespace)?.get(key);
  }

  public async has(namespace: string, key: string): Promise<boolean> {
    return this.store.get(namespace)?.has(key) ?? false;
  }
}

// Mock Decision Engine implementation
class MockDecisionEngine {
  public outcomes: any[] = [];
  public async recordOutcome(outcome: any): Promise<void> {
    this.outcomes.push(outcome);
  }
}

async function runTests() {
  // eslint-disable-next-line no-console
  console.log("=== START SPRINT 18.2 WORKSPACE ENGINE TESTS ===\n");

  const memoryStore = new MockMemoryStore();
  const decisionEngine = new MockDecisionEngine();

  const context = {
    env: "test",
    namespace: "workspace-test-namespace",
    memoryStore,
    decisionEngine,
    startTime: Date.now()
  };

  const config = {
    storageProvider: StorageProvider.LOCAL,
    maxStorageBytes: 1024 * 1024, // 1MB for test
    backupIntervalMs: 5000
  };

  // ==========================================
  // 1. Builder Validation...
  // ==========================================
  try {
    new WorkspaceBuilder().build();
    assert(false, "Should fail without context");
  } catch (err) {
    assert(err instanceof WorkspaceValidationException, "Expected WorkspaceValidationException");
  }

  const workspaceEngine = new WorkspaceBuilder()
    .withContext(context)
    .withConfig(config)
    .build() as WorkspaceEngine;

  assert(workspaceEngine !== null, "Workspace builder should return an instance");
  assert(workspaceEngine.getState() === WorkspaceState.CREATED, "Initial state must be CREATED");
  // eslint-disable-next-line no-console
  console.log("1. Builder Validation... ✓");

  // ==========================================
  // 2. Lifecycle Transitions...
  // ==========================================
  try {
    await workspaceEngine.start();
    assert(false, "Should fail starting before initializing");
  } catch (err) {
    assert(err instanceof InvalidWorkspaceStateException, "Expected InvalidWorkspaceStateException");
  }

  await workspaceEngine.initialize();
  assert(workspaceEngine.getState() === WorkspaceState.READY, "Should transition to READY");
  
  await workspaceEngine.start();
  assert(workspaceEngine.getState() === WorkspaceState.OPEN, "Should transition to OPEN");

  await workspaceEngine.stop();
  assert(workspaceEngine.getState() === WorkspaceState.CLOSED, "Should transition to CLOSED");
  // eslint-disable-next-line no-console
  console.log("2. Lifecycle Transitions... ✓");

  // ==========================================
  // 3. Workspace Creation...
  // ==========================================
  const wsEngine = new WorkspaceBuilder()
    .withContext(context)
    .withConfig(config)
    .build() as WorkspaceEngine;

  await wsEngine.initialize();
  await wsEngine.start();

  const ws = wsEngine.getWorkspaceManager().getWorkspace();
  assert(ws !== undefined, "Should have default workspace");
  assert(ws!.id === "default-workspace", "ID should be default-workspace");
  // eslint-disable-next-line no-console
  console.log("3. Workspace Creation... ✓");

  // ==========================================
  // 4. Project Management...
  // ==========================================
  const pm = wsEngine.getProjectManager();
  const proj = await pm.createProject("Project Alpha", {
    author: "User A",
    tags: ["test", "creative"],
    description: "Creative project sample"
  });

  assert(proj.id === "project-alpha", "Project ID formatted correctly");
  assert(proj.state === ProjectState.CREATED, "State initially CREATED");

  const loaded = await pm.loadProject("project-alpha");
  assert(loaded.name === "Project Alpha", "Loaded project name matches");

  proj.state = ProjectState.ACTIVE;
  await pm.saveProject(proj);
  const updated = await pm.loadProject("project-alpha");
  assert(updated.state === ProjectState.ACTIVE, "State successfully updated to ACTIVE");

  const dup = await pm.duplicateProject("project-alpha", "Project Beta");
  assert(dup.id === "project-beta", "Duplicated project ID matches");
  assert(pm.listProjects().length === 2, "List contains two projects");
  // eslint-disable-next-line no-console
  console.log("4. Project Management... ✓");

  // ==========================================
  // 5. Asset Library...
  // ==========================================
  const library = wsEngine.getAssetLibrary();
  const asset = await library.registerAsset(
    "project-alpha",
    "Audience Research Report",
    "/local/workspace/default/project-alpha/research/audience.txt",
    AssetCategory.RESEARCH,
    2048, // 2KB
    "text/plain",
    ["audience", "report"]
  );

  assert(asset.id === "project-alpha-audience-research-report", "ID resolved");
  assert(asset.status === AssetStatus.READY, "Status is READY");
  
  const fetchedProj = await pm.loadProject("project-alpha");
  assert(fetchedProj.assetsCount === 1, "Project assets count updated to 1");
  // eslint-disable-next-line no-console
  console.log("5. Asset Library... ✓");

  // ==========================================
  // 6. Asset Import...
  // ==========================================
  const imported = await library.importAsset(
    "project-alpha",
    "/external/downloads/script.txt",
    AssetCategory.SCRIPT,
    ["script", "draft"]
  );

  assert(imported.name === "script.txt", "Imported asset name matches file");
  assert(imported.category === AssetCategory.SCRIPT, "Category is SCRIPT");
  // eslint-disable-next-line no-console
  console.log("6. Asset Import... ✓");

  // ==========================================
  // 7. Asset Export...
  // ==========================================
  let exportDone = false;
  wsEngine.on("AssetExported", (ev) => {
    if (ev.payload.assetId === imported.id && ev.payload.destPath === "/exports/script.txt") {
      exportDone = true;
    }
  });

  await library.exportAsset(imported.id, "/exports/script.txt");
  assert(exportDone, "Export event fired and processed");
  // eslint-disable-next-line no-console
  console.log("7. Asset Export... ✓");

  // ==========================================
  // 8. Search Engine...
  // ==========================================
  const searchEngine = wsEngine.getSearchEngine();
  const searchResults = await searchEngine.searchText("Alpha");
  
  assert(searchResults.length > 0, "Should return search results");
  assert(searchResults[0].id === "project-alpha", "First hit is Project Alpha");
  // eslint-disable-next-line no-console
  console.log("8. Search Engine... ✓");

  // ==========================================
  // 9. Semantic Search...
  // ==========================================
  const semanticResults = await searchEngine.searchSemantic("Audience trends");
  assert(semanticResults.length > 0, "Should return matches");
  assert(semanticResults[0].score >= 0.7, "Score should reflect semantic similarity");
  // eslint-disable-next-line no-console
  console.log("9. Semantic Search... ✓");

  // ==========================================
  // 10. Version Management...
  // ==========================================
  const vm = wsEngine.getVersionManager();
  const v1 = await vm.saveVersion("project-alpha", "First stable version");
  assert(v1.versionNumber === 1, "First version number should be 1");
  assert(v1.state === VersionState.CURRENT, "State is CURRENT");

  const v2 = await vm.saveVersion("project-alpha", "Added Script");
  assert(v2.versionNumber === 2, "Second version number should be 2");
  assert(v2.state === VersionState.CURRENT, "Second version is CURRENT");
  
  const historyBefore = vm.getHistory("project-alpha");
  assert(historyBefore.versions?.find(v => v.versionNumber === 1)?.state === VersionState.PREVIOUS, "First version transitioned to PREVIOUS");

  await vm.restoreVersion("project-alpha", 1);
  const historyAfter = vm.getHistory("project-alpha");
  assert(historyAfter.versions.find(v => v.versionNumber === 1)?.state === VersionState.CURRENT, "First version restored to CURRENT");
  // eslint-disable-next-line no-console
  console.log("10. Version Management... ✓");

  // ==========================================
  // 11. Backup...
  // ==========================================
  const bm = wsEngine.getBackupManager();
  const backupJob = await bm.incrementalBackup();
  
  assert(backupJob.state === BackupState.COMPLETED, "Backup state should be COMPLETED");
  assert(backupJob.progressPercent === 100, "Progress should be 100%");
  assert(bm.getBackupHistory().length === 1, "Backup history contains 1 snapshot");
  // eslint-disable-next-line no-console
  console.log("11. Backup... ✓");

  // ==========================================
  // 12. Restore...
  // ==========================================
  const rm = wsEngine.getRestoreManager();
  const latestSnap = bm.getBackupHistory()[0];

  let restoreDone = false;
  wsEngine.on("RestoreCompleted", (ev) => {
    if (ev.payload.snapshotId === latestSnap.id) {
      restoreDone = true;
    }
  });

  await rm.restoreBackup(latestSnap.id);
  assert(restoreDone, "Restore event fired and processed");
  assert(wsEngine.getState() === WorkspaceState.OPEN, "State remains OPEN after restore");
  // eslint-disable-next-line no-console
  console.log("12. Restore... ✓");

  // ==========================================
  // 13. Runtime Integration...
  // ==========================================
  const runtime = new RuntimeBuilder()
    .withContext(context)
    .withConfig({
      env: "test",
      heartbeatIntervalMs: 500,
      healthCheckIntervalMs: 1000,
      startupTimeoutMs: 500,
      shutdownTimeoutMs: 500
    })
    .withHost({ id: "host-1" })
    .build();

  await runtime.initialize();
  await runtime.start();

  // Retrieve WorkspaceEngine from runtime engines list
  const loadedWorkspaceEngine = (runtime as any).getEngine("WorkspaceEngine") as WorkspaceEngine;
  assert(loadedWorkspaceEngine !== undefined, "WorkspaceEngine is auto-registered inside Runtime");
  assert(loadedWorkspaceEngine.getState() === WorkspaceState.OPEN, "Workspace auto-opened during runtime boot");

  await runtime.stop();
  // eslint-disable-next-line no-console
  console.log("13. Runtime Integration... ✓");

  // ==========================================
  // 14. Pipeline Integration...
  // ==========================================
  const pipelineRuntime = new RuntimeBuilder().withContext(context).withHost({ id: "host-1" }).build();
  await pipelineRuntime.initialize();
  await pipelineRuntime.start();

  const pipelineWE = (pipelineRuntime as any).getEngine("WorkspaceEngine") as WorkspaceEngine;
  await pipelineWE.getProjectManager().createProject("Project Alpha", { author: "Pipeline", tags: [] });
  
  // Pipeline simulated outputs registered under workspace structure
  const pipelineResearch = await pipelineWE.getAssetLibrary().registerAsset(
    "project-alpha",
    "Pipeline Research Result",
    "/local/workspace/default/project-alpha/research/out.json",
    AssetCategory.RESEARCH,
    512,
    "application/json"
  );
  assert(pipelineResearch.path.includes("/research/"), "Output correctly routed to research folder");

  const pipelineVideo = await pipelineWE.getAssetLibrary().registerAsset(
    "project-alpha",
    "Pipeline Video Export",
    "/local/workspace/default/project-alpha/video/out.mp4",
    AssetCategory.VIDEO,
    45120,
    "video/mp4"
  );
  assert(pipelineVideo.path.includes("/video/"), "Output correctly routed to video folder");

  await pipelineRuntime.stop();
  // eslint-disable-next-line no-console
  console.log("14. Pipeline Integration... ✓");

  // ==========================================
  // 15. Memory Integration...
  // ==========================================
  // Verify workspace database setting logs in MockMemoryStore
  assert(await memoryStore.has("projects", "proj-project-alpha"), "Project alpha state stored in memory");
  assert(await memoryStore.has("assets", "idx-project-alpha-audience-research-report"), "Asset index stored in memory");
  // eslint-disable-next-line no-console
  console.log("15. Memory Integration... ✓");

  // ==========================================
  // 16. Decision Integration...
  // ==========================================
  assert(decisionEngine.outcomes.length > 0, "Outcomes registered to decision engine");
  assert(decisionEngine.outcomes[0].decisionId === "workspace-usage", "Decision id matched");
  // eslint-disable-next-line no-console
  console.log("16. Decision Integration... ✓");

  // ==========================================
  // 17. Event Publishing...
  // ==========================================
  const testEventsRuntime = new WorkspaceBuilder().withContext(context).build() as WorkspaceEngine;
  let createEvFired = false;
  testEventsRuntime.on("ProjectCreated", () => { createEvFired = true; });

  await testEventsRuntime.initialize();
  await testEventsRuntime.start();
  await testEventsRuntime.getProjectManager().createProject("Event Project", { author: "System", tags: [] });

  assert(createEvFired, "ProjectCreated event published successfully");
  await testEventsRuntime.stop();
  // eslint-disable-next-line no-console
  console.log("17. Event Publishing... ✓");

  // ==========================================
  // 18. Snapshot Immutability...
  // ==========================================
  const snapWE = new WorkspaceBuilder().withContext(context).build() as WorkspaceEngine;
  await snapWE.initialize();
  await snapWE.start();

  const snapshot = snapWE.getReporter().getWorkspaceSnapshot();
  try {
    (snapshot as any).state = WorkspaceState.FAILED;
    assert(false, "Should fail modifying frozen snapshot");
  } catch (err) {
    assert(err instanceof TypeError, "Expected TypeError on modifying frozen snapshot");
  }

  await snapWE.stop();
  // eslint-disable-next-line no-console
  console.log("18. Snapshot Immutability... ✓");

  // ==========================================
  // 19. Validator Rules...
  // ==========================================
  // Duplicate assets check
  try {
    WorkspaceValidator.validateDuplicateAsset("assetA", new Set(["assetA"]));
    assert(false, "Duplicate asset A should fail");
  } catch (err) {
    assert(err instanceof WorkspaceValidationException, "Expected WorkspaceValidationException");
  }

  // Circular asset dependencies check
  try {
    WorkspaceValidator.validateCircularAssetDependencies([
      { assetId: "assetA", dependsOnAssetId: "assetB" },
      { assetId: "assetB", dependsOnAssetId: "assetA" }
    ]);
    assert(false, "Circular dependency should fail");
  } catch (err) {
    assert(err instanceof WorkspaceValidationException, "Expected WorkspaceValidationException");
  }

  // Broken reference check
  try {
    WorkspaceValidator.validateBrokenAssetReferences(
      [{ assetId: "assetA", dependsOnAssetId: "assetC" }],
      new Set(["assetA", "assetB"])
    );
    assert(false, "Broken reference to assetC should fail");
  } catch (err) {
    assert(err instanceof WorkspaceValidationException, "Expected WorkspaceValidationException");
  }
  // eslint-disable-next-line no-console
  console.log("19. Validator Rules... ✓");

  // ==========================================
  // 20. Full End-to-End Workspace Lifecycle...
  // ==========================================
  const e2eWE = new WorkspaceBuilder().withContext(context).build() as WorkspaceEngine;
  await e2eWE.initialize();
  await e2eWE.start();

  // Create project, import asset, add dependency, search, version, backup, stop
  const e2eProj = await e2eWE.getProjectManager().createProject("E2E Proj", { author: "Me", tags: ["e2e"] });
  const asset1 = await e2eWE.getAssetLibrary().registerAsset(e2eProj.id, "Image A", "/img/a.png", AssetCategory.IMAGE, 1024, "image/png");
  const asset2 = await e2eWE.getAssetLibrary().registerAsset(e2eProj.id, "Script B", "/script/b.txt", AssetCategory.SCRIPT, 1024, "text/plain");
  e2eWE.getAssetLibrary().trackDependency(asset1.id, asset2.id);

  const searchRes = await e2eWE.getSearchEngine().searchText("Image");
  assert(searchRes.length === 1 && searchRes[0].id === asset1.id, "Search returns asset1");

  const ver = await e2eWE.getVersionManager().saveVersion(e2eProj.id, "V1");
  assert(ver.versionNumber === 1, "V1 saved");

  const backup = await e2eWE.getBackupManager().fullBackup();
  assert(backup.state === BackupState.COMPLETED, "Backup successful");

  await e2eWE.stop();
  assert(e2eWE.getState() === WorkspaceState.CLOSED, "Workspace stopped cleanly");
  // eslint-disable-next-line no-console
  console.log("20. Full End-to-End Workspace Lifecycle... ✓");

  // eslint-disable-next-line no-console
  console.log("\n=== ALL 20/20 WORKSPACE ENGINE TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Test execution failed:", err);
  process.exit(1);
});
