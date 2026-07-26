import { IWorkspaceEngine } from "../interfaces/interfaces";
import { WorkspaceEngine } from "../engine/WorkspaceEngine";
import { WorkspaceConfiguration } from "../models/models";
import { WorkspaceValidationException } from "../types/types";
import { StorageProvider } from "../models/StorageProvider";

export class WorkspaceBuilder {
  private _context?: any;
  private _config?: WorkspaceConfiguration;

  public withContext(context: any): this {
    this._context = context;
    return this;
  }

  public withConfig(config: WorkspaceConfiguration): this {
    this._config = config;
    return this;
  }

  public build(): IWorkspaceEngine {
    if (!this._context) {
      throw new WorkspaceValidationException("WorkspaceContext is required to build WorkspaceEngine.");
    }

    const config: WorkspaceConfiguration = this._config || {
      storageProvider: StorageProvider.LOCAL,
      maxStorageBytes: 10 * 1024 * 1024 * 1024, // 10 GB default
      backupIntervalMs: 24 * 60 * 60 * 1000 // 24 hours
    };

    return new WorkspaceEngine(this._context, config);
  }
}
