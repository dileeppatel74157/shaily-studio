import { WorkspaceState } from "./WorkspaceState";
import { ProjectState } from "./ProjectState";
import { AssetCategory } from "./AssetCategory";
import { AssetStatus } from "./AssetStatus";
import { VersionState } from "./VersionState";
import { BackupState } from "./BackupState";
import { SearchType } from "./SearchType";
import { StorageProvider } from "./StorageProvider";

export interface Workspace {
  id: string;
  name: string;
  path: string;
  state: WorkspaceState;
  createdAt: Date;
  updatedAt: Date;
  config: WorkspaceConfiguration;
  profile: WorkspaceProfile;
}

export interface WorkspaceRequest {
  id: string;
  name?: string;
  path?: string;
  config?: WorkspaceConfiguration;
  profile?: WorkspaceProfile;
}

export interface WorkspaceResponse {
  workspaceId: string;
  success: boolean;
  state: WorkspaceState;
  error?: string;
  timestamp: Date;
}

export interface WorkspaceConfiguration {
  storageProvider: StorageProvider;
  backupIntervalMs?: number;
  maxStorageBytes?: number;
  qdrantUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkspaceProfile {
  ownerId: string;
  name: string;
  description?: string;
  tags?: string[];
}

export interface Project {
  id: string;
  name: string;
  workspaceId: string;
  state: ProjectState;
  folders: ProjectFolder[];
  assetsCount: number;
  versionsCount: number;
  metadata: ProjectMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectMetadata {
  author: string;
  tags: string[];
  description?: string;
  category?: string;
}

export interface ProjectFolder {
  id: string;
  projectId: string;
  path: string;
  category: AssetCategory;
}

export interface ProjectStatistics {
  storageBytes: number;
  assetsCount: number;
  versionsCount: number;
  uptimeMs?: number;
}

export interface AssetRecord {
  id: string;
  projectId: string;
  name: string;
  path: string;
  category: AssetCategory;
  sizeBytes: number;
  status: AssetStatus;
  mimeType: string;
  version: number;
  tags: string[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssetReference {
  assetId: string;
  referencedByAssetId: string;
  type: string; // e.g., "link", "import"
}

export interface AssetDependency {
  assetId: string;
  dependsOnAssetId: string;
}

export interface AssetCollection {
  id: string;
  name: string;
  assetIds: string[];
  metadata?: Record<string, unknown>;
}

export interface ProjectVersion {
  id: string;
  projectId: string;
  versionNumber: number;
  state: VersionState;
  description: string;
  parentVersionNumber?: number;
  createdAt: Date;
}

export interface AssetVersion {
  assetId: string;
  versionNumber: number;
  path: string;
  sizeBytes: number;
  createdAt: Date;
}

export interface VersionHistory {
  projectId: string;
  versions: ProjectVersion[];
  lastVersionNumber: number;
}

export interface SearchQuery {
  query: string;
  type: SearchType;
  projectId?: string;
  limit?: number;
  offset?: number;
  tags?: string[];
  startDate?: Date;
  endDate?: Date;
}

export interface SearchResult {
  id: string;
  score: number;
  type: "PROJECT" | "ASSET";
  item: any; // Project or AssetRecord
}

export interface SearchIndex {
  id: string;
  targetId: string; // projectId or assetId
  content: string; // terms
  tags: string[];
  updatedAt: Date;
}

export interface BackupJob {
  id: string;
  state: BackupState;
  progressPercent: number;
  snapshotPath?: string;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

export interface BackupSnapshot {
  id: string;
  timestamp: Date;
  sizeBytes: number;
  workspaceId: string;
  snapshotPath: string;
  incremental: boolean;
}

export interface RestoreRequest {
  backupSnapshotId: string;
  targetWorkspaceId?: string;
  force?: boolean;
}

export interface WorkspaceReport {
  timestamp: Date;
  workspaceId: string;
  projectsCount: number;
  assetsCount: number;
  totalStorageBytes: number;
  storageLimitBytes: number;
  databaseHealthy: boolean;
  backupsCount: number;
}

export interface WorkspaceSnapshot {
  timestamp: Date;
  state: WorkspaceState;
  workspace: Workspace;
  projects: Project[];
  assets: AssetRecord[];
  report: WorkspaceReport;
}
