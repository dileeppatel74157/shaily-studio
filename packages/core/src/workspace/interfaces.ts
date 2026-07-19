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

export interface IWorkspaceEngine {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  
  getState(): WorkspaceState;
  getWorkspaceManager(): IWorkspaceManager;
  getProjectManager(): IProjectManager;
  getAssetLibrary(): IAssetLibrary;
  getVersionManager(): IVersionManager;
  getSearchEngine(): ISearchEngine;
  getBackupManager(): IBackupManager;
  getRestoreManager(): IRestoreManager;
  getDatabase(): ILocalDatabase;
  getReporter(): IWorkspaceReporter;
  
  getContext(): any;
  getConfig(): WorkspaceConfiguration;
  
  on(eventType: string, handler: (event: any) => void): void;
  off(eventType: string, handler: (event: any) => void): void;
  emit(eventType: string, payload?: any): void;
}

export interface IWorkspaceManager {
  createWorkspace(request: WorkspaceRequest): Promise<Workspace>;
  openWorkspace(workspaceId: string): Promise<Workspace>;
  closeWorkspace(workspaceId: string): Promise<void>;
  archiveWorkspace(workspaceId: string): Promise<void>;
  deleteWorkspace(workspaceId: string): Promise<void>;
  getWorkspace(): Workspace | undefined;
}

export interface IProjectManager {
  createProject(name: string, metadata: ProjectMetadata): Promise<Project>;
  loadProject(projectId: string): Promise<Project>;
  saveProject(project: Project): Promise<void>;
  duplicateProject(projectId: string, newName: string): Promise<Project>;
  renameProject(projectId: string, newName: string): Promise<void>;
  archiveProject(projectId: string): Promise<void>;
  deleteProject(projectId: string): Promise<void>;
  listProjects(): Project[];
}

export interface IAssetLibrary {
  registerAsset(projectId: string, name: string, path: string, category: AssetCategory, sizeBytes: number, mimeType: string, tags?: string[]): Promise<AssetRecord>;
  importAsset(projectId: string, sourcePath: string, category: AssetCategory, tags?: string[]): Promise<AssetRecord>;
  exportAsset(assetId: string, destPath: string): Promise<void>;
  moveAsset(assetId: string, destPath: string): Promise<void>;
  copyAsset(assetId: string, destPath: string): Promise<AssetRecord>;
  deleteAsset(assetId: string): Promise<void>;
  trackDependency(assetId: string, dependsOnAssetId: string): void;
  getDependencies(assetId: string): string[];
  listAssets(projectId?: string): AssetRecord[];
  getAsset(assetId: string): AssetRecord;
}

export interface IVersionManager {
  saveVersion(projectId: string, description: string): Promise<ProjectVersion>;
  restoreVersion(projectId: string, versionNumber: number): Promise<void>;
  compareVersions(projectId: string, versionA: number, versionB: number): Promise<any>;
  mergeVersions(projectId: string, versionA: number, versionB: number): Promise<void>;
  deleteVersion(projectId: string, versionNumber: number): Promise<void>;
  getHistory(projectId: string): VersionHistory;
}

export interface ISearchEngine {
  searchText(query: string, projectId?: string): Promise<SearchResult[]>;
  searchTags(tags: string[], projectId?: string): Promise<SearchResult[]>;
  searchSemantic(query: string, projectId?: string): Promise<SearchResult[]>;
  searchDate(startDate: Date, endDate: Date, projectId?: string): Promise<SearchResult[]>;
  search(query: SearchQuery): Promise<SearchResult[]>;
}

export interface IBackupManager {
  incrementalBackup(): Promise<BackupJob>;
  fullBackup(): Promise<BackupJob>;
  getBackupHistory(): BackupSnapshot[];
}

export interface IRestoreManager {
  restoreBackup(snapshotId: string, force?: boolean): Promise<void>;
}

export interface ILocalDatabase {
  saveMetadata(key: string, value: any): Promise<void>;
  getMetadata<T>(key: string): Promise<T | undefined>;
  indexAsset(record: AssetRecord): Promise<void>;
  storeProjectState(project: Project): Promise<void>;
  storeSearchIndex(index: SearchIndex): Promise<void>;
  storeSettings(settings: Record<string, any>): Promise<void>;
  getSettings(): Promise<Record<string, any>>;
}

export interface IWorkspaceReporter {
  generateReport(): WorkspaceReport;
  getWorkspaceSnapshot(): WorkspaceSnapshot;
}
