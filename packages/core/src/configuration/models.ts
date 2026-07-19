import { ConfigurationState } from "./ConfigurationState";
import { ConfigurationScope } from "./ConfigurationScope";
import { ConfigurationSource } from "./ConfigurationSource";
import { SecretType } from "./SecretType";
import { ProviderHealth } from "./ProviderHealth";
import { ValidationResult } from "./ValidationResult";
import { ConfigurationEventType } from "./ConfigurationEventType";
import { EnvironmentType } from "./EnvironmentType";

// 1. SecretEntry
export interface SecretEntry {
  id: string;
  key: string;
  value: string;
  type: SecretType;
  masked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 2. SecretStore
export interface SecretStore {
  secrets: SecretEntry[];
  encryptionKey: string;
}

// 3. ProviderCredential
export interface ProviderCredential {
  providerId: string;
  secretKeyId: string;
  enabled: boolean;
}

// 4. ProviderConfiguration
export interface ProviderConfiguration {
  id: string;
  enabled: boolean;
  health: ProviderHealth;
  timeoutMs: number;
  retryLimit: number;
  rateLimitPerMinute: number;
  defaultModel: string;
  credentials: ProviderCredential[];
}

// 5. EnvironmentConfiguration
export interface EnvironmentConfiguration {
  envType: EnvironmentType;
  variables: Record<string, string>;
  sources: Record<string, ConfigurationSource>;
}

// 6. RuntimeConfiguration
export interface RuntimeConfiguration {
  port: number;
  host: string;
  heartbeatMs: number;
  debugMode: boolean;
}

// 7. WorkspaceConfiguration
export interface WorkspaceConfiguration {
  path: string;
  autoSave: boolean;
  ignoredFolders: string[];
}

// 8. ProjectConfiguration
export interface ProjectConfiguration {
  name: string;
  outputPath: string;
  pipelineId?: string;
}

// 9. ConfigurationSnapshot
export interface ConfigurationSnapshot {
  id: string;
  timestamp: Date;
  scope: ConfigurationScope;
  environment: EnvironmentConfiguration;
  providers: ProviderConfiguration[];
  runtime: RuntimeConfiguration;
}

// 10. ConfigurationRequest
export interface ConfigurationRequest {
  scope: ConfigurationScope;
  key: string;
  value: string;
}

// 11. ConfigurationResponse
export interface ConfigurationResponse {
  success: boolean;
  message: string;
  timestamp: Date;
}

// 12. ConfigurationVersion
export interface ConfigurationVersion {
  version: string;
  createdAt: Date;
  author: string;
}

// 13. ConfigurationDiff
export interface ConfigurationDiff {
  snapshotIdA: string;
  snapshotIdB: string;
  changedKeys: string[];
  addedKeys: string[];
  removedKeys: string[];
}

// 14. ValidationIssue
export interface ValidationIssue {
  key: string;
  message: string;
  severity: "info" | "warning" | "error";
}

// 15. ValidationReport
export interface ValidationReport {
  timestamp: Date;
  result: ValidationResult;
  issues: ValidationIssue[];
}

// 16. ProviderHealthReport
export interface ProviderHealthReport {
  providerId: string;
  status: ProviderHealth;
  lastChecked: Date;
  latencyMs: number;
}

// 17. ConfigurationStatistics
export interface ConfigurationStatistics {
  totalKeys: number;
  environmentKeys: number;
  secretsCount: number;
  providerCount: number;
}

// 18. ConfigurationAudit
export interface ConfigurationAudit {
  timestamp: Date;
  action: string;
  actor: string;
  scope: ConfigurationScope;
  key: string;
}

// 19. ConfigurationEvent
export interface ConfigurationEvent {
  id: string;
  type: ConfigurationEventType;
  timestamp: Date;
  payload: any;
}

// 20. ConfigurationStateSnapshot
export interface ConfigurationStateSnapshot {
  state: ConfigurationState;
  timestamp: Date;
}

// 21. SecretAudit
export interface SecretAudit {
  timestamp: Date;
  action: string;
  secretId: string;
}

// 22. ConfigurationProfile
export interface ConfigurationProfile {
  name: string;
  scopes: ConfigurationScope[];
}

// 23. EnvironmentProfile
export interface EnvironmentProfile {
  profileName: string;
  env: EnvironmentType;
}

// 24. ConfigurationSummary
export interface ConfigurationSummary {
  envType: EnvironmentType;
  activeProviders: string[];
  statistics: ConfigurationStatistics;
}
