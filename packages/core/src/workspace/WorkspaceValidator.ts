import { WorkspaceState } from "./WorkspaceState";
import { ProjectState } from "./ProjectState";
import { AssetCategory } from "./AssetCategory";
import { AssetStatus } from "./AssetStatus";
import { VersionState } from "./VersionState";
import { BackupState } from "./BackupState";
import { SearchType } from "./SearchType";
import { StorageProvider } from "./StorageProvider";
import {
  WorkspaceValidationException,
  InvalidWorkspaceStateException,
  VersionException,
  BackupException,
  RestoreException
} from "./types";
import {
  WorkspaceConfiguration,
  WorkspaceProfile,
  ProjectFolder,
  AssetDependency,
  BackupJob,
  BackupSnapshot,
  SearchIndex,
  WorkspaceSnapshot,
  AssetRecord
} from "./models";

export class WorkspaceValidator {
  /**
   * 1. Validate Identifier format.
   */
  public static validateIdentifier(id: string, label: string): void {
    if (!id || typeof id !== "string") {
      throw new WorkspaceValidationException(`${label} must be a non-empty string`);
    }
    const regex = /^[a-zA-Z0-9_\-]+$/;
    if (!regex.test(id)) {
      throw new WorkspaceValidationException(`${label} "${id}" contains illegal characters or spaces.`);
    }
  }

  /**
   * 2. Validate Workspace ID.
   */
  public static validateWorkspaceId(id: string): void {
    this.validateIdentifier(id, "Workspace ID");
  }

  /**
   * 3. Validate Project ID.
   */
  public static validateProjectId(id: string): void {
    this.validateIdentifier(id, "Project ID");
  }

  /**
   * 4. Validate Asset ID.
   */
  public static validateAssetId(id: string): void {
    this.validateIdentifier(id, "Asset ID");
  }

  /**
   * 5. Validate Workspace Configuration.
   */
  public static validateWorkspaceConfig(config: WorkspaceConfiguration): void {
    if (!config) {
      throw new WorkspaceValidationException("Workspace configuration is missing");
    }
    if (!Object.values(StorageProvider).includes(config.storageProvider)) {
      throw new WorkspaceValidationException(`Invalid storage provider "${config.storageProvider}"`);
    }
    if (config.maxStorageBytes !== undefined && (typeof config.maxStorageBytes !== "number" || config.maxStorageBytes <= 0)) {
      throw new WorkspaceValidationException("maxStorageBytes must be a positive number");
    }
    if (config.backupIntervalMs !== undefined && (typeof config.backupIntervalMs !== "number" || config.backupIntervalMs <= 0)) {
      throw new WorkspaceValidationException("backupIntervalMs must be a positive number");
    }
  }

  /**
   * 6. Validate Workspace Profile.
   */
  public static validateWorkspaceProfile(profile: WorkspaceProfile): void {
    if (!profile) {
      throw new WorkspaceValidationException("Workspace profile is missing");
    }
    this.validateIdentifier(profile.ownerId, "Owner ID");
    if (!profile.name || typeof profile.name !== "string") {
      throw new WorkspaceValidationException("Workspace profile name must be a non-empty string");
    }
  }

  /**
   * 7. Validate Workspace State Transition.
   */
  public static validateWorkspaceStateTransition(current: WorkspaceState, target: WorkspaceState): void {
    const allowed: Record<WorkspaceState, WorkspaceState[]> = {
      [WorkspaceState.CREATED]: [WorkspaceState.INITIALIZING, WorkspaceState.FAILED],
      [WorkspaceState.INITIALIZING]: [WorkspaceState.READY, WorkspaceState.FAILED],
      [WorkspaceState.READY]: [WorkspaceState.OPEN, WorkspaceState.CLOSED, WorkspaceState.FAILED],
      [WorkspaceState.OPEN]: [WorkspaceState.BACKING_UP, WorkspaceState.RESTORING, WorkspaceState.CLOSED, WorkspaceState.ARCHIVED, WorkspaceState.FAILED],
      [WorkspaceState.CLOSED]: [WorkspaceState.OPEN, WorkspaceState.ARCHIVED, WorkspaceState.FAILED],
      [WorkspaceState.ARCHIVED]: [WorkspaceState.OPEN, WorkspaceState.FAILED],
      [WorkspaceState.BACKING_UP]: [WorkspaceState.OPEN, WorkspaceState.FAILED],
      [WorkspaceState.RESTORING]: [WorkspaceState.OPEN, WorkspaceState.FAILED],
      [WorkspaceState.FAILED]: [WorkspaceState.INITIALIZING, WorkspaceState.CLOSED, WorkspaceState.OPEN, WorkspaceState.FAILED]
    };
    if (!allowed[current].includes(target)) {
      throw new InvalidWorkspaceStateException(`transition from ${current} to ${target}`, current);
    }
  }

  /**
   * 8. Validate Project State Transition.
   */
  public static validateProjectStateTransition(current: ProjectState, target: ProjectState): void {
    const allowed: Record<ProjectState, ProjectState[]> = {
      [ProjectState.CREATED]: [ProjectState.ACTIVE, ProjectState.DELETED],
      [ProjectState.ACTIVE]: [ProjectState.PAUSED, ProjectState.COMPLETED, ProjectState.ARCHIVED, ProjectState.DELETED],
      [ProjectState.PAUSED]: [ProjectState.ACTIVE, ProjectState.COMPLETED, ProjectState.ARCHIVED, ProjectState.DELETED],
      [ProjectState.COMPLETED]: [ProjectState.ACTIVE, ProjectState.ARCHIVED, ProjectState.DELETED],
      [ProjectState.ARCHIVED]: [ProjectState.ACTIVE, ProjectState.DELETED],
      [ProjectState.DELETED]: [ProjectState.CREATED, ProjectState.DELETED]
    };
    if (!allowed[current].includes(target)) {
      throw new WorkspaceValidationException(`Invalid project state transition from ${current} to ${target}`);
    }
  }

  /**
   * 9. Validate Duplicate Project ID.
   */
  public static validateDuplicateProject(id: string, existingIds: string[] | Set<string>): void {
    const exists = existingIds instanceof Set ? existingIds.has(id) : existingIds.includes(id);
    if (exists) {
      throw new WorkspaceValidationException(`Project with ID "${id}" already exists.`);
    }
  }

  /**
   * 10. Validate Duplicate Asset ID.
   */
  public static validateDuplicateAsset(id: string, existingIds: string[] | Set<string>): void {
    const exists = existingIds instanceof Set ? existingIds.has(id) : existingIds.includes(id);
    if (exists) {
      throw new WorkspaceValidationException(`Asset with ID "${id}" already exists.`);
    }
  }

  /**
   * 11. Validate Circular Asset Dependencies.
   */
  public static validateCircularAssetDependencies(dependencies: AssetDependency[]): void {
    const adj = new Map<string, string[]>();
    for (const dep of dependencies) {
      if (!adj.has(dep.assetId)) adj.set(dep.assetId, []);
      adj.get(dep.assetId)!.push(dep.dependsOnAssetId);
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (node: string) => {
      visited.add(node);
      recStack.add(node);

      const neighbors = adj.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          return true; // cycle
        }
      }

      recStack.delete(node);
      return false;
    };

    for (const dep of dependencies) {
      if (!visited.has(dep.assetId)) {
        if (dfs(dep.assetId)) {
          throw new WorkspaceValidationException("Circular asset dependency detected in project.");
        }
      }
    }
  }

  /**
   * 12. Validate Broken Asset References.
   */
  public static validateBrokenAssetReferences(dependencies: AssetDependency[], existingAssetIds: Set<string>): void {
    for (const dep of dependencies) {
      if (!existingAssetIds.has(dep.dependsOnAssetId)) {
        throw new WorkspaceValidationException(`Broken reference: Asset "${dep.assetId}" depends on non-existent asset "${dep.dependsOnAssetId}".`);
      }
    }
  }

  /**
   * 13. Validate Project Folders.
   */
  public static validateProjectFolders(folders: ProjectFolder[]): void {
    if (!Array.isArray(folders)) {
      throw new WorkspaceValidationException("Folders list must be an array");
    }
    for (const folder of folders) {
      this.validateIdentifier(folder.id, "Folder ID");
      if (!folder.path || typeof folder.path !== "string") {
        throw new WorkspaceValidationException(`Folder "${folder.id}" path must be a non-empty string`);
      }
      if (!Object.values(AssetCategory).includes(folder.category)) {
        throw new WorkspaceValidationException(`Folder "${folder.id}" contains invalid category "${folder.category}"`);
      }
    }
  }

  /**
   * 14. Validate Version State Transition.
   */
  public static validateVersionStateTransition(current: VersionState, target: VersionState): void {
    const allowed: Record<VersionState, VersionState[]> = {
      [VersionState.DRAFT]: [VersionState.CURRENT, VersionState.ARCHIVED],
      [VersionState.CURRENT]: [VersionState.PREVIOUS, VersionState.ARCHIVED],
      [VersionState.PREVIOUS]: [VersionState.CURRENT, VersionState.ARCHIVED],
      [VersionState.ARCHIVED]: [VersionState.DRAFT, VersionState.ARCHIVED]
    };
    if (!allowed[current].includes(target)) {
      throw new VersionException(`Invalid version state transition from ${current} to ${target}`);
    }
  }

  /**
   * 15. Validate Version Number.
   */
  public static validateVersionNumber(num: number): void {
    if (typeof num !== "number" || num <= 0 || !Number.isInteger(num)) {
      throw new VersionException(`Invalid version number "${num}". Must be a positive integer.`);
    }
  }

  /**
   * 16. Validate Backup Job status.
   */
  public static validateBackupJob(job: BackupJob): void {
    if (!job) {
      throw new BackupException("Backup job is missing");
    }
    this.validateIdentifier(job.id, "Backup Job ID");
    if (job.progressPercent < 0 || job.progressPercent > 100) {
      throw new BackupException("Backup job progress percent must be between 0 and 100.");
    }
    if (!Object.values(BackupState).includes(job.state)) {
      throw new BackupException(`Invalid backup state "${job.state}"`);
    }
  }

  /**
   * 17. Validate Restore Consistency.
   */
  public static validateRestoreConsistency(snapshot: BackupSnapshot, currentWorkspaceId: string, force = false): void {
    if (!snapshot) {
      throw new RestoreException("Backup snapshot is missing");
    }
    if (snapshot.workspaceId !== currentWorkspaceId && !force) {
      throw new RestoreException(`Cannot restore backup of workspace "${snapshot.workspaceId}" into workspace "${currentWorkspaceId}" without force flag.`);
    }
  }

  /**
   * 18. Validate Search Index structure.
   */
  public static validateSearchIndex(index: SearchIndex): void {
    if (!index) {
      throw new WorkspaceValidationException("Search index is missing");
    }
    this.validateIdentifier(index.id, "Search Index ID");
    this.validateIdentifier(index.targetId, "Search Target ID");
    if (typeof index.content !== "string") {
      throw new WorkspaceValidationException("Search index content must be a string");
    }
  }

  /**
   * 19. Validate Storage Limit.
   */
  public static validateStorageLimit(currentBytes: number, limitBytes: number, incomingBytes: number): void {
    if (limitBytes > 0 && (currentBytes + incomingBytes) > limitBytes) {
      throw new WorkspaceValidationException(`Storage limit exceeded. Allowed: ${limitBytes} bytes, Requesting: ${currentBytes + incomingBytes} bytes.`);
    }
  }

  /**
   * 20. Validate Snapshot Immutability.
   */
  public static validateSnapshotImmutability(snapshot: WorkspaceSnapshot): void {
    if (!snapshot) {
      throw new WorkspaceValidationException("Snapshot is missing");
    }
    if (!Object.isFrozen(snapshot)) {
      throw new WorkspaceValidationException("WorkspaceSnapshot is not frozen.");
    }
    if (!Object.isFrozen(snapshot.workspace)) {
      throw new WorkspaceValidationException("WorkspaceSnapshot workspace object is not frozen.");
    }
    if (!Object.isFrozen(snapshot.projects) || snapshot.projects.some(p => !Object.isFrozen(p))) {
      throw new WorkspaceValidationException("WorkspaceSnapshot projects array or project objects are not frozen.");
    }
    if (!Object.isFrozen(snapshot.assets) || snapshot.assets.some(a => !Object.isFrozen(a))) {
      throw new WorkspaceValidationException("WorkspaceSnapshot assets array or asset records are not frozen.");
    }
    if (!Object.isFrozen(snapshot.report)) {
      throw new WorkspaceValidationException("WorkspaceSnapshot report object is not frozen.");
    }
  }

  /**
   * 21. Validate Asset Record.
   */
  public static validateAssetRecord(asset: AssetRecord): void {
    if (!asset) {
      throw new WorkspaceValidationException("Asset record is missing");
    }
    this.validateIdentifier(asset.id, "Asset ID");
    this.validateIdentifier(asset.projectId, "Project ID");
    if (!asset.name || typeof asset.name !== "string") {
      throw new WorkspaceValidationException("Asset name must be a non-empty string");
    }
    if (!asset.path || typeof asset.path !== "string") {
      throw new WorkspaceValidationException("Asset path must be a non-empty string");
    }
    if (!Object.values(AssetCategory).includes(asset.category)) {
      throw new WorkspaceValidationException(`Invalid asset category "${asset.category}"`);
    }
    if (typeof asset.sizeBytes !== "number" || asset.sizeBytes < 0) {
      throw new WorkspaceValidationException("Asset sizeBytes must be a non-negative number");
    }
    if (!Object.values(AssetStatus).includes(asset.status)) {
      throw new WorkspaceValidationException(`Invalid asset status "${asset.status}"`);
    }
  }
}
