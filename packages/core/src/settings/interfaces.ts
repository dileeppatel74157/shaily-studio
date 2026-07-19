import { SettingsState } from "./SettingsState";
import { ProviderType } from "./ProviderType";
import { ThemeType } from "./ThemeType";
import { BackupType } from "./BackupType";
import { ImportExportFormat } from "./ImportExportFormat";
import { ConfigurationScope } from "./ConfigurationScope";
import {
  SettingsConfiguration,
  ProviderConfiguration,
  ApiKeyEntry,
  ModelRoutingRule,
  GPUConfiguration,
  RenderConfiguration,
  ThemeConfiguration,
  WorkspaceConfiguration,
  BackupConfiguration,
  BackupRecord,
  RestorePoint,
  ImportRequest,
  ExportRequest,
  ValidationReport,
  SettingsSnapshot,
  SettingsReport,
  ConnectionTestResult,
  ProviderHealth
} from "./models";

export interface IConfigurationManager {
  getConfiguration(): SettingsConfiguration;
  updateConfiguration(config: Partial<SettingsConfiguration>): Promise<void>;
  resetConfiguration(): Promise<void>;
  validateConfiguration(): Promise<ValidationReport>;
}

export interface IApiKeyManager {
  getApiKeys(): ApiKeyEntry[];
  addApiKey(provider: ProviderType, value: string): Promise<void>;
  updateApiKey(id: string, value: string, enabled?: boolean): Promise<void>;
  removeApiKey(id: string): Promise<void>;
  testConnection(provider: ProviderType): Promise<ConnectionTestResult>;
}

export interface IProviderManager {
  getProviders(): ProviderConfiguration[];
  getProvider(providerType: ProviderType): ProviderConfiguration | undefined;
  updateProvider(providerType: ProviderType, config: Partial<ProviderConfiguration>): Promise<void>;
  getProviderHealth(providerType: ProviderType): Promise<ProviderHealth>;
}

export interface IModelRouter {
  getRoutingRules(): ModelRoutingRule[];
  addRoutingRule(rule: ModelRoutingRule): Promise<void>;
  updateRoutingRule(id: string, rule: Partial<ModelRoutingRule>): Promise<void>;
  removeRoutingRule(id: string): Promise<void>;
  resolveProviderForModel(modelId: string): Promise<ProviderType>;
}

export interface IGPUManager {
  getGPUConfiguration(): GPUConfiguration;
  updateGPUConfiguration(config: Partial<GPUConfiguration>): Promise<void>;
  detectHardware(): Promise<{ devices: string[]; hasCuda: boolean }>;
}

export interface IRenderSettingsManager {
  getRenderConfiguration(): RenderConfiguration;
  updateRenderConfiguration(config: Partial<RenderConfiguration>): Promise<void>;
}

export interface IThemeManager {
  getThemeConfiguration(): ThemeConfiguration;
  updateThemeConfiguration(config: Partial<ThemeConfiguration>): Promise<void>;
}

export interface IBackupManager {
  getBackupConfiguration(): BackupConfiguration;
  updateBackupConfiguration(config: Partial<BackupConfiguration>): Promise<void>;
  createBackup(type: BackupType): Promise<BackupRecord>;
  getBackupHistory(): BackupRecord[];
  restoreBackup(backupId: string): Promise<void>;
}

export interface IImportExportManager {
  importSettings(request: ImportRequest): Promise<void>;
  exportSettings(request: ExportRequest): Promise<string>;
}

export interface ISettingsEngine {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  
  getState(): SettingsState;
  getSnapshot(): SettingsSnapshot;
  getReport(): Promise<SettingsReport>;
  
  getConfigurationManager(): IConfigurationManager;
  getApiKeyManager(): IApiKeyManager;
  getProviderManager(): IProviderManager;
  getRouter(): IModelRouter;
  getGPUManager(): IGPUManager;
  getRenderManager(): IRenderSettingsManager;
  getThemeManager(): IThemeManager;
  getBackupManager(): IBackupManager;
  getImportExportManager(): IImportExportManager;
}
