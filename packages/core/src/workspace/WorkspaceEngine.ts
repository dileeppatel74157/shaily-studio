import {
  IWorkspaceEngine,
  IWorkspaceManager,
  IProjectManager,
  IAssetLibrary,
  IVersionManager,
  ISearchEngine,
  IBackupManager,
  IRestoreManager,
  ILocalDatabase,
  IWorkspaceReporter
} from "./interfaces";
import { WorkspaceState } from "./WorkspaceState";
import { ProjectState } from "./ProjectState";
import { AssetCategory } from "./AssetCategory";
import { AssetStatus } from "./AssetStatus";
import { VersionState } from "./VersionState";
import { BackupState } from "./BackupState";
import { SearchType } from "./SearchType";
import { StorageProvider } from "./StorageProvider";
import {
  Workspace,
  WorkspaceRequest,
  WorkspaceResponse,
  WorkspaceConfiguration,
  WorkspaceProfile,
  Project,
  ProjectMetadata,
  ProjectFolder,
  ProjectStatistics,
  AssetRecord,
  AssetReference,
  AssetDependency,
  AssetCollection,
  ProjectVersion,
  AssetVersion,
  VersionHistory,
  SearchQuery,
  SearchResult,
  SearchIndex,
  BackupJob,
  BackupSnapshot,
  RestoreRequest,
  WorkspaceReport,
  WorkspaceSnapshot
} from "./models";
import {
  WorkspaceException,
  ProjectNotFoundException,
  AssetNotFoundException,
  VersionException,
  BackupException,
  RestoreException,
  WorkspaceValidationException,
  InvalidWorkspaceStateException,
  deepFreeze
} from "./types";
import { WorkspaceValidator } from "./WorkspaceValidator";

export class WorkspaceEngine implements IWorkspaceEngine {
  private _state = WorkspaceState.CREATED;
  private readonly _eventHandlers = new Map<string, Set<(event: any) => void>>();

  // Sub-components
  private readonly _workspaceManager: WorkspaceManagerImpl;
  private readonly _projectManager: ProjectManagerImpl;
  private readonly _assetLibrary: AssetLibraryImpl;
  private readonly _versionManager: VersionManagerImpl;
  private readonly _searchEngine: SearchEngineImpl;
  private readonly _backupManager: BackupManagerImpl;
  private readonly _restoreManager: IRestoreManager;
  private readonly _database: LocalDatabaseImpl;
  private readonly _reporter: WorkspaceReporterImpl;

  constructor(
    private readonly _context: any,
    private readonly _config: WorkspaceConfiguration
  ) {
    WorkspaceValidator.validateWorkspaceConfig(_config);

    this._database = new LocalDatabaseImpl(this);
    this._workspaceManager = new WorkspaceManagerImpl(this);
    this._projectManager = new ProjectManagerImpl(this);
    this._assetLibrary = new AssetLibraryImpl(this);
    this._versionManager = new VersionManagerImpl(this);
    this._searchEngine = new SearchEngineImpl(this);
    this._backupManager = new BackupManagerImpl(this);
    this._restoreManager = this._backupManager;
    this._reporter = new WorkspaceReporterImpl(this);
  }

  // --- IWorkspaceEngine implementation ---

  public async initialize(): Promise<void> {
    if (this._state === WorkspaceState.CLOSED) {
      this._state = WorkspaceState.CREATED;
    }
    if (this._state !== WorkspaceState.CREATED) {
      throw new InvalidWorkspaceStateException("initialize", this._state);
    }
    
    this._state = WorkspaceState.INITIALIZING;
    await this.logToMemory("workspace", "initialize_start", { timestamp: new Date() });

    try {
      // Auto-discover/load default workspace if exists, otherwise create it
      let workspace: Workspace;
      try {
        workspace = await this._workspaceManager.openWorkspace("default-workspace");
      } catch {
        workspace = await this._workspaceManager.createWorkspace({
          id: "default-workspace",
          name: "Default Local Workspace",
          path: "/local/workspace/default",
          config: this._config,
          profile: {
            ownerId: "user-1",
            name: "Default Profile",
            description: "Default developer profile"
          }
        });
        await this._workspaceManager.openWorkspace("default-workspace");
      }

      this._state = WorkspaceState.READY;
      await this.logToMemory("workspace", "initialize_success", { timestamp: new Date(), workspaceId: workspace.id });
    } catch (err: any) {
      this._state = WorkspaceState.FAILED;
      await this.logToMemory("workspace", "initialize_failed", { timestamp: new Date(), error: err.message });
      throw new WorkspaceException(`Workspace initialization failed: ${err.message}`);
    }
  }

  public async start(): Promise<void> {
    if (this._state !== WorkspaceState.READY && this._state !== WorkspaceState.CLOSED) {
      throw new InvalidWorkspaceStateException("start", this._state);
    }

    this._state = WorkspaceState.OPEN;
    this.emit("WorkspaceOpened", { workspaceId: this._workspaceManager.getWorkspace()?.id, timestamp: new Date() });
    await this.logToMemory("workspace", "start_success", { timestamp: new Date() });

    // Decision engine integration: Log workspace metrics
    if (this._context.decisionEngine && typeof this._context.decisionEngine.recordOutcome === "function") {
      const report = this._reporter.generateReport();
      await this._context.decisionEngine.recordOutcome({
        id: `workspace-start-outcome-${Date.now()}`,
        decisionId: "workspace-usage",
        chosenOptionId: "local-workspace",
        score: 1.0,
        metrics: { projectsCount: report.projectsCount, assetsCount: report.assetsCount },
        timestamp: new Date()
      });
    }
  }

  public async stop(): Promise<void> {
    if (this._state !== WorkspaceState.OPEN) {
      throw new InvalidWorkspaceStateException("stop", this._state);
    }

    const ws = this._workspaceManager.getWorkspace();
    if (ws) {
      await this._workspaceManager.closeWorkspace(ws.id);
    }
    this._state = WorkspaceState.CLOSED;
    this.emit("WorkspaceClosed", { timestamp: new Date() });
    await this.logToMemory("workspace", "stop_success", { timestamp: new Date() });
  }

  public getState(): WorkspaceState {
    return this._state;
  }

  public getWorkspaceManager(): IWorkspaceManager {
    return this._workspaceManager;
  }

  public getProjectManager(): IProjectManager {
    return this._projectManager;
  }

  public getAssetLibrary(): IAssetLibrary {
    return this._assetLibrary;
  }

  public getVersionManager(): IVersionManager {
    return this._versionManager;
  }

  public getSearchEngine(): ISearchEngine {
    return this._searchEngine;
  }

  public getBackupManager(): IBackupManager {
    return this._backupManager;
  }

  public getRestoreManager(): IRestoreManager {
    return this._restoreManager;
  }

  public getDatabase(): ILocalDatabase {
    return this._database;
  }

  public getReporter(): IWorkspaceReporter {
    return this._reporter;
  }

  public getContext(): any {
    return this._context;
  }

  public getConfig(): WorkspaceConfiguration {
    return this._config;
  }

  public on(eventType: string, handler: (event: any) => void): void {
    if (!this._eventHandlers.has(eventType)) {
      this._eventHandlers.set(eventType, new Set());
    }
    this._eventHandlers.get(eventType)!.add(handler);
  }

  public off(eventType: string, handler: (event: any) => void): void {
    if (this._eventHandlers.has(eventType)) {
      this._eventHandlers.get(eventType)!.delete(handler);
    }
  }

  public emit(eventType: string, payload?: any): void {
    const event = {
      type: eventType,
      timestamp: new Date(),
      payload
    };

    const handlers = this._eventHandlers.get(eventType);
    if (handlers) {
      for (const h of handlers) {
        try {
          h(event);
        } catch (err) {
          // Suppress handler errors
        }
      }
    }

    this.logToMemory("workspace-events", `event-${Date.now()}`, event).catch(() => {});
  }

  // --- Helper Methods ---

  public async logToMemory(namespace: string, key: string, value: any): Promise<void> {
    if (this._context.memoryStore && typeof this._context.memoryStore.set === "function") {
      try {
        await this._context.memoryStore.set(namespace, key, value);
      } catch (err) {
        // Suppress memory write errors
      }
    }
  }

  public setWorkspaceState(state: WorkspaceState) {
    this._state = state;
  }
}

// ─── Workspace Manager Implementation ──────────────────────────────────────────

class WorkspaceManagerImpl implements IWorkspaceManager {
  private currentWorkspace?: Workspace;
  private readonly workspaces = new Map<string, Workspace>();

  constructor(private readonly engine: WorkspaceEngine) {}

  public async createWorkspace(request: WorkspaceRequest): Promise<Workspace> {
    WorkspaceValidator.validateWorkspaceId(request.id);
    if (this.workspaces.has(request.id)) {
      throw new WorkspaceValidationException(`Workspace with ID "${request.id}" already exists.`);
    }

    WorkspaceValidator.validateWorkspaceConfig(request.config || this.engine.getConfig());
    WorkspaceValidator.validateWorkspaceProfile(request.profile!);

    const ws: Workspace = {
      id: request.id,
      name: request.name || "Default Workspace",
      path: request.path || `/local/workspace/${request.id}`,
      state: WorkspaceState.CREATED,
      createdAt: new Date(),
      updatedAt: new Date(),
      config: request.config || this.engine.getConfig(),
      profile: request.profile!
    };

    this.workspaces.set(ws.id, ws);
    this.engine.emit("WorkspaceCreated", { workspaceId: ws.id });
    await this.engine.logToMemory("workspace", `ws-${ws.id}`, ws);
    return ws;
  }

  public async openWorkspace(workspaceId: string): Promise<Workspace> {
    WorkspaceValidator.validateWorkspaceId(workspaceId);
    const ws = this.workspaces.get(workspaceId);
    if (!ws) {
      throw new WorkspaceValidationException(`Workspace "${workspaceId}" does not exist.`);
    }

    if (this.currentWorkspace) {
      await this.closeWorkspace(this.currentWorkspace.id);
    }

    ws.state = WorkspaceState.OPEN;
    ws.updatedAt = new Date();
    this.currentWorkspace = ws;
    
    this.engine.emit("WorkspaceOpened", { workspaceId });
    return ws;
  }

  public async closeWorkspace(workspaceId: string): Promise<void> {
    WorkspaceValidator.validateWorkspaceId(workspaceId);
    if (!this.currentWorkspace || this.currentWorkspace.id !== workspaceId) {
      return;
    }
    this.currentWorkspace.state = WorkspaceState.CLOSED;
    this.currentWorkspace = undefined;
    this.engine.emit("WorkspaceClosed", { workspaceId });
  }

  public async archiveWorkspace(workspaceId: string): Promise<void> {
    WorkspaceValidator.validateWorkspaceId(workspaceId);
    const ws = this.workspaces.get(workspaceId);
    if (!ws) {
      throw new WorkspaceValidationException(`Workspace "${workspaceId}" does not exist.`);
    }
    if (this.currentWorkspace?.id === workspaceId) {
      await this.closeWorkspace(workspaceId);
    }
    ws.state = WorkspaceState.ARCHIVED;
  }

  public async deleteWorkspace(workspaceId: string): Promise<void> {
    WorkspaceValidator.validateWorkspaceId(workspaceId);
    if (this.currentWorkspace?.id === workspaceId) {
      await this.closeWorkspace(workspaceId);
    }
    this.workspaces.delete(workspaceId);
  }

  public getWorkspace(): Workspace | undefined {
    return this.currentWorkspace;
  }
}

// ─── Project Manager Implementation ────────────────────────────────────────────

class ProjectManagerImpl implements IProjectManager {
  private readonly projects = new Map<string, Project>();

  constructor(private readonly engine: WorkspaceEngine) {}

  public async createProject(name: string, metadata: ProjectMetadata): Promise<Project> {
    const ws = this.engine.getWorkspaceManager().getWorkspace();
    if (!ws) {
      throw new WorkspaceException("No workspace is currently open.");
    }

    const projectId = name.toLowerCase().replace(/\s+/g, "-");
    WorkspaceValidator.validateProjectId(projectId);
    WorkspaceValidator.validateDuplicateProject(projectId, new Set(this.projects.keys()));

    const categories = [
      AssetCategory.RESEARCH,
      AssetCategory.SCRIPT,
      AssetCategory.IMAGE,
      AssetCategory.VIDEO,
      AssetCategory.EXPORT
    ];

    const folders: ProjectFolder[] = categories.map(cat => ({
      id: `${projectId}-${cat.toLowerCase()}`,
      projectId,
      path: `${ws.path}/${projectId}/${cat.toLowerCase()}`,
      category: cat
    }));

    WorkspaceValidator.validateProjectFolders(folders);

    const project: Project = {
      id: projectId,
      name,
      workspaceId: ws.id,
      state: ProjectState.CREATED,
      folders,
      assetsCount: 0,
      versionsCount: 0,
      metadata,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.projects.set(projectId, project);
    await this.engine.getDatabase().storeProjectState(project);
    this.engine.emit("ProjectCreated", { projectId, workspaceId: ws.id });
    
    return project;
  }

  public async loadProject(projectId: string): Promise<Project> {
    WorkspaceValidator.validateProjectId(projectId);
    const proj = this.projects.get(projectId);
    if (!proj) {
      throw new ProjectNotFoundException(projectId);
    }
    return proj;
  }

  public async saveProject(project: Project): Promise<void> {
    WorkspaceValidator.validateProjectId(project.id);
    const existing = this.projects.get(project.id);
    if (!existing) {
      throw new ProjectNotFoundException(project.id);
    }
    project.updatedAt = new Date();
    this.projects.set(project.id, project);
    await this.engine.getDatabase().storeProjectState(project);
  }

  public async duplicateProject(projectId: string, newName: string): Promise<Project> {
    const orig = await this.loadProject(projectId);
    const dupMeta: ProjectMetadata = { ...orig.metadata };
    const dup = await this.createProject(newName, dupMeta);
    
    // Duplicate assets
    const assets = this.engine.getAssetLibrary().listAssets(projectId);
    for (const asset of assets) {
      await this.engine.getAssetLibrary().registerAsset(
        dup.id,
        asset.name,
        asset.path.replace(`/${projectId}/`, `/${dup.id}/`),
        asset.category,
        asset.sizeBytes,
        asset.mimeType,
        asset.tags
      );
    }

    return dup;
  }

  public async renameProject(projectId: string, newName: string): Promise<void> {
    const proj = await this.loadProject(projectId);
    proj.name = newName;
    await this.saveProject(proj);
  }

  public async archiveProject(projectId: string): Promise<void> {
    const proj = await this.loadProject(projectId);
    const oldState = proj.state;
    WorkspaceValidator.validateProjectStateTransition(oldState, ProjectState.ARCHIVED);
    proj.state = ProjectState.ARCHIVED;
    await this.saveProject(proj);
  }

  public async deleteProject(projectId: string): Promise<void> {
    WorkspaceValidator.validateProjectId(projectId);
    if (!this.projects.has(projectId)) {
      throw new ProjectNotFoundException(projectId);
    }
    this.projects.delete(projectId);
    this.engine.emit("ProjectDeleted", { projectId });
  }

  public listProjects(): Project[] {
    return Array.from(this.projects.values());
  }
}

// ─── Asset Library Implementation ──────────────────────────────────────────────

class AssetLibraryImpl implements IAssetLibrary {
  private readonly assets = new Map<string, AssetRecord>();
  private readonly dependencies: AssetDependency[] = [];

  constructor(private readonly engine: WorkspaceEngine) {}

  public async registerAsset(
    projectId: string,
    name: string,
    path: string,
    category: AssetCategory,
    sizeBytes: number,
    mimeType: string,
    tags?: string[]
  ): Promise<AssetRecord> {
    WorkspaceValidator.validateProjectId(projectId);
    const assetId = `${projectId}-${name.toLowerCase().replace(/\s+/g, "-").replace(/\./g, "-")}`;
    WorkspaceValidator.validateAssetId(assetId);
    WorkspaceValidator.validateDuplicateAsset(assetId, new Set(this.assets.keys()));

    const asset: AssetRecord = {
      id: assetId,
      projectId,
      name,
      path,
      category,
      sizeBytes,
      status: AssetStatus.CREATED,
      mimeType,
      version: 1,
      tags: tags || [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    WorkspaceValidator.validateAssetRecord(asset);
    
    // Check storage limits
    const stats = this.engine.getReporter().generateReport();
    WorkspaceValidator.validateStorageLimit(stats.totalStorageBytes, stats.storageLimitBytes, sizeBytes);

    asset.status = AssetStatus.READY;
    this.assets.set(assetId, asset);

    // Update project count
    const project = await this.engine.getProjectManager().loadProject(projectId);
    project.assetsCount++;
    await this.engine.getProjectManager().saveProject(project);

    await this.engine.getDatabase().indexAsset(asset);
    return asset;
  }

  public async importAsset(projectId: string, sourcePath: string, category: AssetCategory, tags?: string[]): Promise<AssetRecord> {
    const filename = sourcePath.split("/").pop() || "imported-asset";
    const asset = await this.registerAsset(
      projectId,
      filename,
      `/local/workspace/${projectId}/${category.toLowerCase()}/${filename}`,
      category,
      1024, // simulated size
      "application/octet-stream",
      tags
    );

    this.engine.emit("AssetImported", { assetId: asset.id, sourcePath });
    return asset;
  }

  public async exportAsset(assetId: string, destPath: string): Promise<void> {
    const asset = this.getAsset(assetId);
    this.engine.emit("AssetExported", { assetId, destPath });
  }

  public async moveAsset(assetId: string, destPath: string): Promise<void> {
    const asset = this.getAsset(assetId);
    (asset as any).path = destPath;
    asset.updatedAt = new Date();
  }

  public async copyAsset(assetId: string, destPath: string): Promise<AssetRecord> {
    const orig = this.getAsset(assetId);
    const copy = await this.registerAsset(
      orig.projectId,
      `copy-${orig.name}`,
      destPath,
      orig.category,
      orig.sizeBytes,
      orig.mimeType,
      orig.tags
    );
    return copy;
  }

  public async deleteAsset(assetId: string): Promise<void> {
    WorkspaceValidator.validateAssetId(assetId);
    const asset = this.assets.get(assetId);
    if (!asset) {
      throw new AssetNotFoundException(assetId);
    }
    
    this.assets.delete(assetId);

    // Remove dependencies references
    const idx = this.dependencies.findIndex(d => d.assetId === assetId || d.dependsOnAssetId === assetId);
    if (idx !== -1) {
      this.dependencies.splice(idx, 1);
    }

    // Decrement project count
    const project = await this.engine.getProjectManager().loadProject(asset.projectId);
    project.assetsCount = Math.max(0, project.assetsCount - 1);
    await this.engine.getProjectManager().saveProject(project);
  }

  public trackDependency(assetId: string, dependsOnAssetId: string): void {
    WorkspaceValidator.validateAssetId(assetId);
    WorkspaceValidator.validateAssetId(dependsOnAssetId);

    const tempDeps = [...this.dependencies, { assetId, dependsOnAssetId }];
    WorkspaceValidator.validateCircularAssetDependencies(tempDeps);
    
    const assetIds = new Set(this.assets.keys());
    WorkspaceValidator.validateBrokenAssetReferences(tempDeps, assetIds);

    this.dependencies.push({ assetId, dependsOnAssetId });
  }

  public getDependencies(assetId: string): string[] {
    return this.dependencies.filter(d => d.assetId === assetId).map(d => d.dependsOnAssetId);
  }

  public listAssets(projectId?: string): AssetRecord[] {
    const all = Array.from(this.assets.values());
    return projectId ? all.filter(a => a.projectId === projectId) : all;
  }

  public getAsset(assetId: string): AssetRecord {
    const asset = this.assets.get(assetId);
    if (!asset) {
      throw new AssetNotFoundException(assetId);
    }
    return asset;
  }
}

// ─── Version Manager Implementation ────────────────────────────────────────────

class VersionManagerImpl implements IVersionManager {
  private readonly histories = new Map<string, ProjectVersion[]>();

  constructor(private readonly engine: WorkspaceEngine) {}

  public async saveVersion(projectId: string, description: string): Promise<ProjectVersion> {
    const project = await this.engine.getProjectManager().loadProject(projectId);
    
    if (!this.histories.has(projectId)) {
      this.histories.set(projectId, []);
    }
    const history = this.histories.get(projectId)!;
    const versionNumber = history.length + 1;

    const version: ProjectVersion = {
      id: `${projectId}-v${versionNumber}`,
      projectId,
      versionNumber,
      state: VersionState.CURRENT,
      description,
      parentVersionNumber: versionNumber > 1 ? versionNumber - 1 : undefined,
      createdAt: new Date()
    };

    // Transition previous CURRENT versions to PREVIOUS
    for (const v of history) {
      if (v.state === VersionState.CURRENT) {
        v.state = VersionState.PREVIOUS;
      }
    }

    history.push(version);
    project.versionsCount = versionNumber;
    await this.engine.getProjectManager().saveProject(project);

    this.engine.emit("VersionCreated", { projectId, versionNumber });
    return version;
  }

  public async restoreVersion(projectId: string, versionNumber: number): Promise<void> {
    WorkspaceValidator.validateVersionNumber(versionNumber);
    const history = this.histories.get(projectId) || [];
    const target = history.find(v => v.versionNumber === versionNumber);
    if (!target) {
      throw new VersionException(`Version "${versionNumber}" was not found.`);
    }

    // Mark target as CURRENT, others as PREVIOUS
    for (const v of history) {
      if (v.versionNumber === versionNumber) {
        v.state = VersionState.CURRENT;
      } else if (v.state === VersionState.CURRENT) {
        v.state = VersionState.PREVIOUS;
      }
    }

    this.engine.emit("VersionRestored", { projectId, versionNumber });
  }

  public async compareVersions(projectId: string, versionA: number, versionB: number): Promise<any> {
    WorkspaceValidator.validateVersionNumber(versionA);
    WorkspaceValidator.validateVersionNumber(versionB);
    return {
      projectId,
      versionA,
      versionB,
      differences: ["Metadata changed", "Asset count changed"]
    };
  }

  public async mergeVersions(projectId: string, versionA: number, versionB: number): Promise<void> {
    WorkspaceValidator.validateVersionNumber(versionA);
    WorkspaceValidator.validateVersionNumber(versionB);
    await this.saveVersion(projectId, `Merged version ${versionA} and ${versionB}`);
  }

  public async deleteVersion(projectId: string, versionNumber: number): Promise<void> {
    WorkspaceValidator.validateVersionNumber(versionNumber);
    const history = this.histories.get(projectId) || [];
    const idx = history.findIndex(v => v.versionNumber === versionNumber);
    if (idx !== -1) {
      history.splice(idx, 1);
    }
  }

  public getHistory(projectId: string): VersionHistory {
    const versions = this.histories.get(projectId) || [];
    return {
      projectId,
      versions,
      lastVersionNumber: versions.length
    };
  }
}

// ─── Search Engine Implementation ──────────────────────────────────────────────

class SearchEngineImpl implements ISearchEngine {
  constructor(private readonly engine: WorkspaceEngine) {}

  public async searchText(query: string, projectId?: string): Promise<SearchResult[]> {
    return this.search({ query, type: SearchType.TEXT, projectId });
  }

  public async searchTags(tags: string[], projectId?: string): Promise<SearchResult[]> {
    return this.search({ query: tags.join(","), type: SearchType.TAG, projectId, tags });
  }

  public async searchSemantic(query: string, projectId?: string): Promise<SearchResult[]> {
    return this.search({ query, type: SearchType.SEMANTIC, projectId });
  }

  public async searchDate(startDate: Date, endDate: Date, projectId?: string): Promise<SearchResult[]> {
    return this.search({ query: "", type: SearchType.DATE, projectId, startDate, endDate });
  }

  public async search(query: SearchQuery): Promise<SearchResult[]> {
    const projects = this.engine.getProjectManager().listProjects();
    const assets = this.engine.getAssetLibrary().listAssets();
    const results: SearchResult[] = [];

    const lowerQuery = query.query.toLowerCase();

    // Check projects
    for (const proj of projects) {
      if (query.projectId && proj.id !== query.projectId) continue;

      let score = 0;
      if (query.type === SearchType.TEXT || query.type === SearchType.PROJECT) {
        if (proj.name.toLowerCase().includes(lowerQuery) || proj.metadata.description?.toLowerCase().includes(lowerQuery)) {
          score = 0.95;
        }
      } else if (query.type === SearchType.TAG && query.tags) {
        const matches = proj.metadata.tags.filter(t => query.tags!.includes(t)).length;
        if (matches > 0) score = matches / query.tags.length;
      } else if (query.type === SearchType.SEMANTIC) {
        score = 0.82; // Simulated vector score
      } else if (query.type === SearchType.DATE && query.startDate && query.endDate) {
        if (proj.createdAt >= query.startDate && proj.createdAt <= query.endDate) {
          score = 1.0;
        }
      }

      if (score > 0) {
        results.push({ id: proj.id, score, type: "PROJECT", item: proj });
      }
    }

    // Check assets
    for (const asset of assets) {
      if (query.projectId && asset.projectId !== query.projectId) continue;

      let score = 0;
      if (query.type === SearchType.TEXT || query.type === SearchType.ASSET) {
        if (asset.name.toLowerCase().includes(lowerQuery) || asset.path.toLowerCase().includes(lowerQuery)) {
          score = 0.9;
        }
      } else if (query.type === SearchType.TAG && query.tags) {
        const matches = asset.tags.filter(t => query.tags!.includes(t)).length;
        if (matches > 0) score = matches / query.tags.length;
      } else if (query.type === SearchType.SEMANTIC) {
        score = 0.78; // Simulated vector score
      } else if (query.type === SearchType.DATE && query.startDate && query.endDate) {
        if (asset.createdAt >= query.startDate && asset.createdAt <= query.endDate) {
          score = 1.0;
        }
      }

      if (score > 0) {
        results.push({ id: asset.id, score, type: "ASSET", item: asset });
      }
    }

    results.sort((a, b) => b.score - a.score);
    this.engine.emit("SearchExecuted", { query, resultsCount: results.length });
    return results;
  }
}

// ─── Backup Manager Implementation ─────────────────────────────────────────────

class BackupManagerImpl implements IBackupManager, IRestoreManager {
  private readonly history: BackupSnapshot[] = [];
  private readonly jobs: BackupJob[] = [];

  constructor(private readonly engine: WorkspaceEngine) {}

  public async incrementalBackup(): Promise<BackupJob> {
    return this.executeBackup(true);
  }

  public async fullBackup(): Promise<BackupJob> {
    return this.executeBackup(false);
  }

  public getBackupHistory(): BackupSnapshot[] {
    return this.history;
  }

  public async restoreBackup(snapshotId: string, force = false): Promise<void> {
    const ws = this.engine.getWorkspaceManager().getWorkspace();
    if (!ws) {
      throw new RestoreException("No workspace is currently open.");
    }

    this.engine.emit("RestoreStarted", { snapshotId });
    this.engine.setWorkspaceState(WorkspaceState.RESTORING);

    try {
      const snap = this.history.find(h => h.id === snapshotId);
      if (!snap) {
        throw new RestoreException(`Backup snapshot "${snapshotId}" does not exist.`);
      }

      WorkspaceValidator.validateRestoreConsistency(snap, ws.id, force);

      // simulate restore delay
      await new Promise(resolve => setTimeout(resolve, 10));

      this.engine.setWorkspaceState(WorkspaceState.OPEN);
      this.engine.emit("RestoreCompleted", { snapshotId });
    } catch (err: any) {
      this.engine.setWorkspaceState(WorkspaceState.FAILED);
      throw err;
    }
  }

  private async executeBackup(incremental: boolean): Promise<BackupJob> {
    const ws = this.engine.getWorkspaceManager().getWorkspace();
    if (!ws) {
      throw new BackupException("No workspace is currently open.");
    }

    const jobId = `backup-job-${Date.now()}`;
    const job: BackupJob = {
      id: jobId,
      state: BackupState.RUNNING,
      progressPercent: 10,
      startedAt: new Date()
    };
    
    this.jobs.push(job);
    this.engine.emit("BackupStarted", { jobId, incremental });
    this.engine.setWorkspaceState(WorkspaceState.BACKING_UP);

    try {
      // Simulate file packing progress
      job.progressPercent = 50;
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const snapId = `snapshot-${Date.now()}`;
      const snapshotPath = `${ws.path}/backups/${snapId}.zip`;
      
      job.progressPercent = 100;
      job.state = BackupState.COMPLETED;
      job.snapshotPath = snapshotPath;
      job.completedAt = new Date();

      WorkspaceValidator.validateBackupJob(job);

      const snapshot: BackupSnapshot = {
        id: snapId,
        timestamp: new Date(),
        sizeBytes: 25 * 1024,
        workspaceId: ws.id,
        snapshotPath,
        incremental
      };

      this.history.push(snapshot);
      this.engine.setWorkspaceState(WorkspaceState.OPEN);
      this.engine.emit("BackupCompleted", { jobId, snapshotId: snapId });
      
      return job;
    } catch (err: any) {
      job.state = BackupState.FAILED;
      job.error = err.message;
      this.engine.setWorkspaceState(WorkspaceState.FAILED);
      throw new BackupException(err.message);
    }
  }
}

// ─── Local Database Implementation ─────────────────────────────────────────────

class LocalDatabaseImpl implements ILocalDatabase {
  private readonly metadata = new Map<string, any>();
  private readonly indexedAssets = new Map<string, AssetRecord>();
  private readonly projectStates = new Map<string, Project>();
  private readonly searchIndexes = new Map<string, SearchIndex>();
  private readonly settings = new Map<string, any>();

  constructor(private readonly engine: WorkspaceEngine) {}

  public async saveMetadata(key: string, value: any): Promise<void> {
    this.metadata.set(key, value);
    await this.engine.logToMemory("database", `meta-${key}`, value);
  }

  public async getMetadata<T>(key: string): Promise<T | undefined> {
    return this.metadata.get(key) as T;
  }

  public async indexAsset(record: AssetRecord): Promise<void> {
    this.indexedAssets.set(record.id, record);
    await this.engine.logToMemory("assets", `idx-${record.id}`, record);
    
    // Auto store search index
    const index: SearchIndex = {
      id: `index-${record.id}`,
      targetId: record.id,
      content: `${record.name} ${record.path} ${record.category}`,
      tags: record.tags,
      updatedAt: new Date()
    };
    await this.storeSearchIndex(index);
  }

  public async storeProjectState(project: Project): Promise<void> {
    this.projectStates.set(project.id, project);
    await this.engine.logToMemory("projects", `proj-${project.id}`, project);
  }

  public async storeSearchIndex(index: SearchIndex): Promise<void> {
    WorkspaceValidator.validateSearchIndex(index);
    this.searchIndexes.set(index.id, index);
    await this.engine.logToMemory("search", `index-${index.id}`, index);
  }

  public async storeSettings(settings: Record<string, any>): Promise<void> {
    for (const [k, v] of Object.entries(settings)) {
      this.settings.set(k, v);
    }
  }

  public async getSettings(): Promise<Record<string, any>> {
    const obj: Record<string, any> = {};
    for (const [k, v] of this.settings.entries()) {
      obj[k] = v;
    }
    return obj;
  }

  public isHealthy(): boolean {
    return true; // Memory db is always healthy
  }
}

// ─── Workspace Reporter Implementation ──────────────────────────────────────────

class WorkspaceReporterImpl implements IWorkspaceReporter {
  constructor(private readonly engine: WorkspaceEngine) {}

  public generateReport(): WorkspaceReport {
    const ws = this.engine.getWorkspaceManager().getWorkspace();
    const projects = this.engine.getProjectManager().listProjects();
    const assets = this.engine.getAssetLibrary().listAssets();
    const totalStorageBytes = assets.reduce((acc, a) => acc + a.sizeBytes, 0);

    return {
      timestamp: new Date(),
      workspaceId: ws?.id || "none",
      projectsCount: projects.length,
      assetsCount: assets.length,
      totalStorageBytes,
      storageLimitBytes: ws?.config.maxStorageBytes || 1024 * 1024 * 1024,
      databaseHealthy: (this.engine.getDatabase() as LocalDatabaseImpl).isHealthy(),
      backupsCount: this.engine.getBackupManager().getBackupHistory().length
    };
  }

  public getWorkspaceSnapshot(): WorkspaceSnapshot {
    const ws = this.engine.getWorkspaceManager().getWorkspace();
    if (!ws) {
      throw new WorkspaceException("No workspace is open.");
    }
    const projects = this.engine.getProjectManager().listProjects();
    const assets = this.engine.getAssetLibrary().listAssets();
    
    const clone = (obj: any) => {
      if (!obj) return obj;
      return JSON.parse(JSON.stringify(obj));
    };

    const snap: WorkspaceSnapshot = {
      timestamp: new Date(),
      state: this.engine.getState(),
      workspace: clone(ws),
      projects: clone(projects),
      assets: clone(assets),
      report: clone(this.generateReport())
    };

    snap.workspace.createdAt = new Date(snap.workspace.createdAt);
    snap.workspace.updatedAt = new Date(snap.workspace.updatedAt);
    for (const p of snap.projects) {
      p.createdAt = new Date(p.createdAt);
      p.updatedAt = new Date(p.updatedAt);
    }
    for (const a of snap.assets) {
      a.createdAt = new Date(a.createdAt);
      a.updatedAt = new Date(a.updatedAt);
    }
    snap.report.timestamp = new Date(snap.report.timestamp);

    const frozenSnap = deepFreeze(snap);
    WorkspaceValidator.validateSnapshotImmutability(frozenSnap);
    return frozenSnap;
  }
}
