import { ConfigurationState } from "./ConfigurationState";
import { ConfigurationScope } from "./ConfigurationScope";
import { ConfigurationSource } from "./ConfigurationSource";
import { SecretType } from "./SecretType";
import { ProviderHealth } from "./ProviderHealth";
import { ValidationResult } from "./ValidationResult";
import { EnvironmentType } from "./EnvironmentType";
import {
  ConfigurationRequest,
  ConfigurationResponse,
  EnvironmentConfiguration,
  ProviderConfiguration,
  SecretEntry,
  ConfigurationSnapshot,
  ConfigurationDiff,
  ValidationReport,
  ProviderHealthReport,
  ConfigurationSummary,
  RuntimeConfiguration,
  WorkspaceConfiguration
} from "./models";

export interface IEnvironmentManager {
  loadEnvironment(): Promise<EnvironmentConfiguration>;
  getEnvironment(): EnvironmentConfiguration;
  resolveVariable(key: string): string | undefined;
}

export interface ISecretsManager {
  loadSecrets(): Promise<SecretEntry[]>;
  getSecrets(): SecretEntry[];
  encryptSecret(plainText: string): Promise<string>;
  decryptSecret(cipherText: string): Promise<string>;
  maskSecret(secret: string): string;
  addSecret(key: string, value: string, type: SecretType): Promise<SecretEntry>;
}

export interface IConfigurationValidator {
  validate(snapshot: ConfigurationSnapshot): Promise<ValidationReport>;
}

export interface IProviderConfigurationManager {
  getProviderConfiguration(providerId: string): ProviderConfiguration | undefined;
  updateProviderConfiguration(providerId: string, config: Partial<ProviderConfiguration>): Promise<void>;
  getProviders(): ProviderConfiguration[];
}

export interface IConfigurationDistributor {
  distributeConfiguration(): Promise<void>;
  registerListener(listener: (config: ConfigurationSnapshot) => void): void;
}

export interface IConfigurationSnapshotManager {
  createSnapshot(): Promise<ConfigurationSnapshot>;
  rollbackToSnapshot(snapshotId: string): Promise<void>;
  compareSnapshots(idA: string, idB: string): Promise<ConfigurationDiff>;
  getSnapshotHistory(): ConfigurationSnapshot[];
}

export interface IConfigurationHealthChecker {
  checkHealth(): Promise<ProviderHealthReport[]>;
}

export interface IConfigurationReporter {
  generateSummary(): Promise<ConfigurationSummary>;
}

export interface IConfigurationLoader {
  load(scope: ConfigurationScope): Promise<ConfigurationSnapshot>;
}

export interface IConfigurationEngine {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  
  getState(): ConfigurationState;
  getSnapshot(): ConfigurationSnapshot;
  
  getEnvironmentManager(): IEnvironmentManager;
  getSecretsManager(): ISecretsManager;
  getValidator(): IConfigurationValidator;
  getProviderManager(): IProviderConfigurationManager;
  getDistributor(): IConfigurationDistributor;
  getSnapshotManager(): IConfigurationSnapshotManager;
  getHealthChecker(): IConfigurationHealthChecker;
  getReporter(): IConfigurationReporter;
  getLoader(): IConfigurationLoader;
}
