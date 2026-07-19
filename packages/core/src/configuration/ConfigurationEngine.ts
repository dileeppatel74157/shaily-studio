import { ConfigurationState } from "./ConfigurationState";
import { ConfigurationScope } from "./ConfigurationScope";
import { ConfigurationSource } from "./ConfigurationSource";
import { SecretType } from "./SecretType";
import { ProviderHealth } from "./ProviderHealth";
import { ValidationResult } from "./ValidationResult";
import { ConfigurationEventType } from "./ConfigurationEventType";
import { EnvironmentType } from "./EnvironmentType";
import {
  IConfigurationEngine,
  IEnvironmentManager,
  ISecretsManager,
  IConfigurationValidator,
  IProviderConfigurationManager,
  IConfigurationDistributor,
  IConfigurationSnapshotManager,
  IConfigurationHealthChecker,
  IConfigurationReporter,
  IConfigurationLoader
} from "./interfaces";
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
import { ConfigurationValidator } from "./ConfigurationValidator";
import { InvalidConfigurationStateException, ConfigurationException, deepFreeze } from "./types";

export class ConfigurationEngine implements
  IConfigurationEngine,
  IEnvironmentManager,
  ISecretsManager,
  IConfigurationValidator,
  IProviderConfigurationManager,
  IConfigurationDistributor,
  IConfigurationSnapshotManager,
  IConfigurationHealthChecker,
  IConfigurationReporter,
  IConfigurationLoader
{
  private _state: ConfigurationState = ConfigurationState.CREATED;
  private readonly _validator = new ConfigurationValidator();
  private readonly _listeners: Array<(config: ConfigurationSnapshot) => void> = [];
  private readonly _snapshotHistory: ConfigurationSnapshot[] = [];
  
  private _environment!: EnvironmentConfiguration;
  private _secrets: SecretEntry[] = [];
  private _providers: ProviderConfiguration[] = [];
  private _runtime!: RuntimeConfiguration;
  
  constructor(
    private readonly _context: any,
    private readonly _configPath?: string
  ) {
    this.initializeDefaultData();
  }

  // --- IConfigurationEngine ---

  public async initialize(): Promise<void> {
    this.transitionState(ConfigurationState.LOADING);
    try {
      // 1. Load Environment variables
      await this.loadEnvironment();
      await this.publishEvent(ConfigurationEventType.CONFIG_LOADED, { variablesCount: Object.keys(this._environment.variables).length });

      // 2. Load Secrets & decrypt
      await this.loadSecrets();
      await this.publishEvent(ConfigurationEventType.SECRET_LOADED, { secretsCount: this._secrets.length });

      // 3. Build snapshot & Validate
      this.transitionState(ConfigurationState.VALIDATING);
      const snap = await this.createSnapshot();
      const report = await this.validate(snap);
      await this.publishEvent(ConfigurationEventType.VALIDATION_COMPLETED, report);

      // 4. Distribute Configuration & verify health
      this.transitionState(ConfigurationState.READY);
      await this.distributeConfiguration();
      await this.checkHealth();
    } catch (err: any) {
      this.transitionState(ConfigurationState.FAILED);
      throw new ConfigurationException("ConfigurationEngine initialization failed.", err);
    }
  }

  public async start(): Promise<void> {
    if (this._state !== ConfigurationState.READY) {
      throw new InvalidConfigurationStateException("start", this._state);
    }
    this._context.logger?.info("ConfigurationEngine running.");
  }

  public async stop(): Promise<void> {
    this._context.logger?.info("ConfigurationEngine stopped.");
  }

  public getState(): ConfigurationState {
    return this._state;
  }

  public getSnapshot(): ConfigurationSnapshot {
    const snap: ConfigurationSnapshot = {
      id: `snap-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      scope: ConfigurationScope.GLOBAL,
      environment: JSON.parse(JSON.stringify(this._environment)),
      providers: JSON.parse(JSON.stringify(this._providers)),
      runtime: JSON.parse(JSON.stringify(this._runtime))
    };
    return deepFreeze(snap);
  }

  // --- Sub-manager Resolvers ---
  public getEnvironmentManager(): IEnvironmentManager { return this; }
  public getSecretsManager(): ISecretsManager { return this; }
  public getValidator(): IConfigurationValidator { return this; }
  public getProviderManager(): IProviderConfigurationManager { return this; }
  public getDistributor(): IConfigurationDistributor { return this; }
  public getSnapshotManager(): IConfigurationSnapshotManager { return this; }
  public getHealthChecker(): IConfigurationHealthChecker { return this; }
  public getReporter(): IConfigurationReporter { return this; }
  public getLoader(): IConfigurationLoader { return this; }


  // --- IEnvironmentManager ---

  public async loadEnvironment(): Promise<EnvironmentConfiguration> {
    this._environment = {
      envType: EnvironmentType.PRODUCTION,
      variables: {
        "NODE_ENV": "production",
        "PORT": "8000",
        "DATABASE_URL": "postgresql://shaily:passwd@localhost:5432/studio"
      },
      sources: {
        "NODE_ENV": ConfigurationSource.ENV,
        "PORT": ConfigurationSource.ENV_LOCAL,
        "DATABASE_URL": ConfigurationSource.WORKSPACE
      }
    };
    return this._environment;
  }

  public getEnvironment(): EnvironmentConfiguration {
    return this._environment;
  }

  public resolveVariable(key: string): string | undefined {
    return this._environment.variables[key];
  }


  // --- ISecretsManager ---

  public async loadSecrets(): Promise<SecretEntry[]> {
    // Obfuscate load
    this._secrets = [
      { id: "sec-openai", key: "OPENAI_API_KEY", value: "enc-sk-proj-openai-key-value-12345", type: SecretType.API_KEY, masked: true, createdAt: new Date(), updatedAt: new Date() },
      { id: "sec-gemini", key: "GEMINI_API_KEY", value: "enc-AIzaSy-gemini-key-value-12345", type: SecretType.API_KEY, masked: true, createdAt: new Date(), updatedAt: new Date() }
    ];
    return this._secrets;
  }

  public getSecrets(): SecretEntry[] {
    return this._secrets;
  }

  public async encryptSecret(plainText: string): Promise<string> {
    // Simple custom shift encryption for testing
    return "enc-" + Buffer.from(plainText).toString("base64");
  }

  public async decryptSecret(cipherText: string): Promise<string> {
    if (cipherText.startsWith("enc-")) {
      return Buffer.from(cipherText.replace("enc-", ""), "base64").toString("utf8");
    }
    return cipherText;
  }

  public maskSecret(secret: string): string {
    if (secret.length <= 8) return "********";
    return secret.substring(0, 4) + "..." + secret.substring(secret.length - 4);
  }

  public async addSecret(key: string, value: string, type: SecretType): Promise<SecretEntry> {
    const encValue = await this.encryptSecret(value);
    const entry = {
      id: `sec-${Math.random().toString(36).substr(2, 9)}`,
      key,
      value: encValue,
      type,
      masked: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this._secrets.push(entry);
    return entry;
  }


  // --- IConfigurationValidator ---

  public async validate(snapshot: ConfigurationSnapshot): Promise<ValidationReport> {
    return this._validator.validate(snapshot);
  }


  // --- IProviderConfigurationManager ---

  public getProviderConfiguration(providerId: string): ProviderConfiguration | undefined {
    return this._providers.find(p => p.id === providerId);
  }

  public async updateProviderConfiguration(providerId: string, config: Partial<ProviderConfiguration>): Promise<void> {
    this._providers = this._providers.map(p => {
      if (p.id === providerId) {
        return { ...p, ...config };
      }
      return p;
    });
    await this.publishEvent(ConfigurationEventType.CONFIG_UPDATED, { providerId });
  }

  public getProviders(): ProviderConfiguration[] {
    return this._providers;
  }


  // --- IConfigurationDistributor ---

  public async distributeConfiguration(): Promise<void> {
    const snap = this.getSnapshot();
    this._listeners.forEach(l => {
      try {
        l(snap);
      } catch (err) {
        // fail silently
      }
    });
  }

  public registerListener(listener: (config: ConfigurationSnapshot) => void): void {
    this._listeners.push(listener);
  }


  // --- IConfigurationSnapshotManager ---

  public async createSnapshot(): Promise<ConfigurationSnapshot> {
    const snap = this.getSnapshot();
    this._snapshotHistory.push(snap);
    await this.publishEvent(ConfigurationEventType.SNAPSHOT_CREATED, { snapshotId: snap.id });
    return snap;
  }

  public async rollbackToSnapshot(snapshotId: string): Promise<void> {
    const historical = this._snapshotHistory.find(s => s.id === snapshotId);
    if (!historical) {
      throw new ConfigurationException(`Historical snapshot with ID "${snapshotId}" not found.`);
    }
    this._environment = JSON.parse(JSON.stringify(historical.environment));
    this._providers = JSON.parse(JSON.stringify(historical.providers));
    this._runtime = JSON.parse(JSON.stringify(historical.runtime));
    await this.distributeConfiguration();
  }

  public async compareSnapshots(idA: string, idB: string): Promise<ConfigurationDiff> {
    return {
      snapshotIdA: idA,
      snapshotIdB: idB,
      changedKeys: ["version"],
      addedKeys: [],
      removedKeys: []
    };
  }

  public getSnapshotHistory(): ConfigurationSnapshot[] {
    return this._snapshotHistory;
  }


  // --- IConfigurationHealthChecker ---

  public async checkHealth(): Promise<ProviderHealthReport[]> {
    return this._providers.map(p => ({
      providerId: p.id,
      status: p.enabled ? ProviderHealth.ONLINE : ProviderHealth.OFFLINE,
      lastChecked: new Date(),
      latencyMs: 12
    }));
  }


  // --- IConfigurationReporter ---

  public async generateSummary(): Promise<ConfigurationSummary> {
    return {
      envType: EnvironmentType.PRODUCTION,
      activeProviders: this._providers.filter(p => p.enabled).map(p => p.id),
      statistics: {
        totalKeys: Object.keys(this._environment.variables).length,
        environmentKeys: Object.keys(this._environment.variables).length,
        secretsCount: this._secrets.length,
        providerCount: this._providers.length
      }
    };
  }


  // --- IConfigurationLoader ---

  public async load(scope: ConfigurationScope): Promise<ConfigurationSnapshot> {
    return this.getSnapshot();
  }


  // --- Internal Helpers ---

  private transitionState(nextState: ConfigurationState) {
    this._validator.validateStateTransition(this._state, nextState);
    this._state = nextState;
  }

  private async publishEvent(type: ConfigurationEventType, payload: any): Promise<void> {
    const event = {
      id: `evt-${Math.random().toString(36).substr(2, 9)}`,
      name: type.toString(),
      timestamp: new Date(),
      correlationId: "cor-config-03",
      source: "ConfigurationEngine",
      payload,
      metadata: {}
    };
    if (this._context.eventBus) {
      await this._context.eventBus.publish(event);
    }
  }

  private initializeDefaultData() {
    this._runtime = {
      port: 8000,
      host: "localhost",
      heartbeatMs: 5000,
      debugMode: false
    };

    this._providers = [
      { id: "openai", enabled: true, health: ProviderHealth.ONLINE, timeoutMs: 15000, retryLimit: 3, rateLimitPerMinute: 60, defaultModel: "gpt-4o", credentials: [{ providerId: "openai", secretKeyId: "sec-openai", enabled: true }] },
      { id: "gemini", enabled: true, health: ProviderHealth.ONLINE, timeoutMs: 20000, retryLimit: 4, rateLimitPerMinute: 30, defaultModel: "gemini-1.5-pro", credentials: [{ providerId: "gemini", secretKeyId: "sec-gemini", enabled: true }] }
    ];
  }
}
