import { ProviderType } from "./ProviderType";
import { ThemeType } from "./ThemeType";
import { BackupType } from "./BackupType";
import { ImportExportFormat } from "./ImportExportFormat";
import { ConfigurationScope } from "./ConfigurationScope";
import { ValidationSeverity } from "./ValidationSeverity";
import { SettingsState } from "./SettingsState";
import { SettingsCategory } from "./SettingsCategory";

// 1. ApiKeyEntry
export interface ApiKeyEntry {
  id: string;
  provider: ProviderType;
  value: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 2. ProviderConfiguration
export interface ProviderConfiguration {
  id: string;
  providerType: ProviderType;
  defaultModel: string;
  timeoutMs: number;
  retryCount: number;
  rateLimitPerMinute: number;
  priority: number;
  enabled: boolean;
  costTrackingEnabled: boolean;
  localFallbackEnabled: boolean;
}

// 3. ModelRoutingRule
export interface ModelRoutingRule {
  id: string;
  modelPattern: string; // e.g., 'gpt-*' or '*'
  preferredProvider: ProviderType;
  fallbackProvider?: ProviderType;
  localFirstMode: boolean;
  costOptimizationEnabled: boolean;
  speedOptimizationEnabled: boolean;
  qualityOptimizationEnabled: boolean;
  manualRoutingOverride?: ProviderType;
  enabled: boolean;
}

// 4. GPUConfiguration
export interface GPUConfiguration {
  gpuEnabled: boolean;
  deviceSelection: string; // e.g., 'cuda:0'
  vramLimitGb: number;
  batchSize: number;
  concurrentGenerationsLimit: number;
  hardwareAccelerationEnabled: boolean;
  cudaOptions: Record<string, any>;
  cpuFallbackEnabled: boolean;
}

// 5. RenderConfiguration
export interface RenderConfiguration {
  resolution: string; // e.g. '1920x1080'
  fps: number;
  codec: string;
  bitrateKbps: number;
  exportFormat: string;
  qualityPreset: "low" | "medium" | "high" | "lossless";
  audioBitrateKbps: number;
  hardwareEncoderSelection: string;
}

// 6. ThemeConfiguration
export interface ThemeConfiguration {
  theme: ThemeType;
  accentColor: string;
  fontSize: number;
  sidebarWidthPx: number;
  panelLayout: string;
  windowBehavior: {
    rememberSize: boolean;
    alwaysOnTop: boolean;
  };
}

// 7. WorkspaceConfiguration
export interface WorkspaceConfiguration {
  rootDirectory: string;
  autoSaveIntervalMs: number;
  recentProjects: string[];
  maxRecentProjectsCount: number;
  gitIntegrationEnabled: boolean;
}

// 8. BackupConfiguration
export interface BackupConfiguration {
  backupEnabled: boolean;
  backupType: BackupType;
  backupDirectory: string;
  compressionEnabled: boolean;
  retentionCount: number;
  verificationEnabled: boolean;
}

// 9. SettingsConfiguration (Main container)
export interface SettingsConfiguration {
  version: string;
  scope: ConfigurationScope;
  apiKeys: ApiKeyEntry[];
  providers: ProviderConfiguration[];
  routingRules: ModelRoutingRule[];
  gpu: GPUConfiguration;
  render: RenderConfiguration;
  theme: ThemeConfiguration;
  workspace: WorkspaceConfiguration;
  backup: BackupConfiguration;
}

// 10. BackupRecord
export interface BackupRecord {
  id: string;
  timestamp: Date;
  type: BackupType;
  filePath: string;
  sizeBytes: number;
  verified: boolean;
  checksum: string;
}

// 11. RestorePoint
export interface RestorePoint {
  id: string;
  timestamp: Date;
  description: string;
  settingsSnapshot: SettingsConfiguration;
}

// 12. ImportRequest
export interface ImportRequest {
  format: ImportExportFormat;
  payload: string;
  scope: ConfigurationScope;
  mergeStrategy: "overwrite" | "merge_keep" | "merge_overwrite";
}

// 13. ExportRequest
export interface ExportRequest {
  format: ImportExportFormat;
  scope: ConfigurationScope;
}

// 14. ValidationIssue
export interface ValidationIssue {
  category: SettingsCategory;
  field: string;
  message: string;
  severity: ValidationSeverity;
}

// 15. ValidationReport
export interface ValidationReport {
  timestamp: Date;
  isValid: boolean;
  issues: ValidationIssue[];
}

// 16. SettingsSnapshot
export interface SettingsSnapshot {
  state: SettingsState;
  configuration: SettingsConfiguration;
  timestamp: Date;
}

// 17. SettingsMetrics
export interface SettingsMetrics {
  totalApiKeysCount: number;
  activeApiKeysCount: number;
  totalProvidersCount: number;
  activeProvidersCount: number;
  loadLatencyMs: number;
  saveLatencyMs: number;
}

// 18. SettingsHistory
export interface SettingsHistory {
  id: string;
  timestamp: Date;
  action: string;
  operator: string;
  changes: Record<string, { oldValue: any; newValue: any }>;
}

// 19. ConnectionTestResult
export interface ConnectionTestResult {
  provider: ProviderType;
  success: boolean;
  latencyMs: number;
  errorMessage?: string;
}

// 20. ProviderHealth
export interface ProviderHealth {
  provider: ProviderType;
  status: "healthy" | "degraded" | "failed";
  lastChecked: Date;
  details?: Record<string, any>;
}

// 21. RuntimeConfigurationReference
export interface RuntimeConfigurationReference {
  env: string;
  version: string;
  activeHost: string;
  settingsFilePath: string;
}

// 22. SettingsEvent
export interface SettingsEvent {
  id: string;
  name: string;
  timestamp: Date;
  payload: any;
}

// 23. SettingsReport
export interface SettingsReport {
  snapshot: SettingsSnapshot;
  validationReport: ValidationReport;
  metrics: SettingsMetrics;
  healthStatuses: ProviderHealth[];
}

// 24. SettingsResponse
export interface SettingsResponse {
  success: boolean;
  message: string;
  validationReport?: ValidationReport;
  data?: any;
}
