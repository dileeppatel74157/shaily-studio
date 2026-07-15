import { IConfiguration } from "./IConfiguration";
import { ConfigurationContext } from "./ConfigurationContext";
import { ConfigurationSchema } from "./ConfigurationSchema";
import { ConfigurationProvider, MemoryConfigurationProvider } from "./ConfigurationProvider";
import { ConfigurationSnapshot } from "./ConfigurationSnapshot";
import { ConfigurationChange } from "./ConfigurationChange";
import { ConfigurationValue } from "./ConfigurationValue";
import { ConfigurationSection } from "./ConfigurationSection";
import { ConfigurationWatcher, ConfigurationWatcherCallback } from "./ConfigurationWatcher";
import { ConfigurationValidator } from "./ConfigurationValidator";
import { ConfigurationState } from "./ConfigurationState";
import {
  ConfigurationValidationException,
  InvalidConfigurationStateException,
  deepFreeze,
} from "./types";

export class Configuration implements IConfiguration {
  private readonly _context: ConfigurationContext;
  private readonly _schema: ConfigurationSchema;
  private readonly _providers: ConfigurationProvider[] = [];
  private readonly _runtimeProvider = new MemoryConfigurationProvider("runtime-overrides", 9999);
  private readonly _metadata: Readonly<Record<string, unknown>>;
  
  private _values: Record<string, unknown> = {};
  private _sourcesMap: Record<string, string> = {};
  private readonly _watcher = new ConfigurationWatcher();
  private readonly _history: ConfigurationChange[] = [];
  private _state: ConfigurationState = ConfigurationState.CREATED;

  constructor(
    context: ConfigurationContext,
    schema: ConfigurationSchema,
    providers: ConfigurationProvider[],
    metadata?: Record<string, unknown>
  ) {
    ConfigurationValidator.validateContext(context);
    ConfigurationValidator.validateSchema(schema);

    this._context = context;
    this._schema = schema;
    this._providers = [...providers, this._runtimeProvider];
    this._metadata = metadata ? { ...metadata } : {};
  }

  public async initialize(): Promise<void> {
    if (this._state !== ConfigurationState.CREATED) {
      throw new InvalidConfigurationStateException("initialize", this._state);
    }
    try {
      this._state = ConfigurationState.READY;
    } catch (err) {
      this._state = ConfigurationState.FAILED;
      throw err;
    }
  }

  public async start(): Promise<void> {
    if (this._state !== ConfigurationState.READY) {
      throw new InvalidConfigurationStateException("start", this._state);
    }
    try {
      await this.evaluate();
      this._state = ConfigurationState.RUNNING;
    } catch (err) {
      this._state = ConfigurationState.FAILED;
      throw err;
    }
  }

  public async stop(): Promise<void> {
    if (this._state !== ConfigurationState.RUNNING) {
      throw new InvalidConfigurationStateException("stop", this._state);
    }
    try {
      this._state = ConfigurationState.STOPPED;
    } catch (err) {
      this._state = ConfigurationState.FAILED;
      throw err;
    }
  }

  public get<T>(key: string): T {
    if (this._state !== ConfigurationState.RUNNING) {
      throw new InvalidConfigurationStateException("get", this._state);
    }

    if (key in this._values) {
      return this._values[key] as T;
    }

    const schemaItem = this._schema[key];
    if (schemaItem && schemaItem.default !== undefined) {
      return schemaItem.default as T;
    }

    return undefined as unknown as T;
  }

  public async set(key: string, value: unknown): Promise<void> {
    if (this._state !== ConfigurationState.RUNNING) {
      throw new InvalidConfigurationStateException("set", this._state);
    }

    ConfigurationValidator.validateIdentifier(key, "Configuration key");

    const schemaItem = this._schema[key];
    if (schemaItem) {
      ConfigurationValidator.validateValueType(key, value, schemaItem);
    }

    this._runtimeProvider.set(key, value);
    await this.evaluate();
  }

  public has(key: string): boolean {
    if (this._state !== ConfigurationState.RUNNING) {
      throw new InvalidConfigurationStateException("has", this._state);
    }
    return key in this._values || (this._schema[key]?.default !== undefined);
  }

  public async remove(key: string): Promise<void> {
    if (this._state !== ConfigurationState.RUNNING) {
      throw new InvalidConfigurationStateException("remove", this._state);
    }
    this._runtimeProvider.remove(key);
    await this.evaluate();
  }

  public async registerProvider(provider: ConfigurationProvider): Promise<void> {
    if (this._state !== ConfigurationState.RUNNING) {
      throw new InvalidConfigurationStateException("registerProvider", this._state);
    }

    ConfigurationValidator.validateProvider(provider, this._providers);
    this._providers.push(provider);
    await this.evaluate();
  }

  public async unregisterProvider(name: string): Promise<void> {
    if (this._state !== ConfigurationState.RUNNING) {
      throw new InvalidConfigurationStateException("unregisterProvider", this._state);
    }

    if (name === "runtime-overrides") {
      throw new ConfigurationValidationException("Cannot unregister internal overrides provider");
    }

    const index = this._providers.findIndex((p) => p.name === name);
    if (index === -1) {
      throw new ConfigurationValidationException(`Provider "${name}" not found`);
    }

    this._providers.splice(index, 1);
    await this.evaluate();
  }

  public async reload(): Promise<void> {
    if (this._state !== ConfigurationState.RUNNING) {
      throw new InvalidConfigurationStateException("reload", this._state);
    }
    await this.evaluate();
  }

  public watch(callback: ConfigurationWatcherCallback): string {
    if (this._state !== ConfigurationState.RUNNING) {
      throw new InvalidConfigurationStateException("watch", this._state);
    }
    return this._watcher.watch(callback);
  }

  public unwatch(watcherId: string): boolean {
    if (this._state !== ConfigurationState.RUNNING) {
      throw new InvalidConfigurationStateException("unwatch", this._state);
    }
    return this._watcher.unwatch(watcherId);
  }

  public snapshot(): ConfigurationSnapshot {
    if (this._state !== ConfigurationState.RUNNING && this._state !== ConfigurationState.STOPPED) {
      throw new InvalidConfigurationStateException("snapshot", this._state);
    }

    const providerNames = [...this._providers]
      .sort((a, b) => b.priority - a.priority)
      .map((p) => p.name);

    const snapshotObj: ConfigurationSnapshot = {
      timestamp: new Date(),
      schema: { ...this._schema },
      sections: this.buildSections(),
      values: { ...this._values },
      providers: providerNames,
      metadata: { ...this._context.metadata, ...this._metadata },
    };

    return deepFreeze(snapshotObj);
  }

  private async evaluate(): Promise<void> {
    const merged: Record<string, unknown> = {};
    const sources: Record<string, string> = {};

    // Sort providers by priority: lowest first, highest last so highest overrides lowest
    const sortedProviders = [...this._providers].sort(
      (a, b) => a.priority - b.priority
    );

    for (const provider of sortedProviders) {
      const data = await provider.load();
      for (const key of Object.keys(data)) {
        merged[key] = data[key];
        sources[key] = provider.name;
      }
    }

    // Apply defaults from schema for missing values
    for (const key of Object.keys(this._schema)) {
      const item = this._schema[key];
      if (merged[key] === undefined && item.default !== undefined) {
        merged[key] = item.default;
        sources[key] = "schema-defaults";
      }
    }

    // Validate type of all merged configurations
    for (const key of Object.keys(merged)) {
      const schemaItem = this._schema[key];
      if (schemaItem) {
        ConfigurationValidator.validateValueType(key, merged[key], schemaItem);
      }
    }

    // Verify all required schema elements are present
    ConfigurationValidator.validateRequiredValues(this._schema, merged);

    // Compute changes
    const changes: ConfigurationChange[] = [];
    const timestamp = new Date();

    // Check changed or added keys
    for (const key of Object.keys(merged)) {
      const oldValue = this._values[key];
      const newValue = merged[key];
      if (oldValue !== newValue) {
        changes.push({
          key,
          oldValue,
          newValue,
          timestamp,
        });
      }
    }

    // Check removed keys
    for (const key of Object.keys(this._values)) {
      if (merged[key] === undefined) {
        changes.push({
          key,
          oldValue: this._values[key],
          newValue: undefined,
          timestamp,
        });
      }
    }

    // Update state
    this._values = merged;
    this._sourcesMap = sources;

    if (changes.length > 0) {
      this._history.push(...changes);
      this._watcher.notify(changes);
    }
  }

  private buildSections(): ConfigurationSection[] {
    const root: {
      path: string;
      values: ConfigurationValue[];
      subsections: Record<string, any>;
    } = { path: "", values: [], subsections: {} };

    for (const key of Object.keys(this._values)) {
      const parts = key.split(".");
      let current = root;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current.subsections[part]) {
          const currentPath = current.path ? `${current.path}.${part}` : part;
          current.subsections[part] = {
            path: currentPath,
            values: [],
            subsections: {},
          };
        }
        current = current.subsections[part];
      }

      const valObj: ConfigurationValue = {
        key,
        value: this._values[key],
        timestamp: new Date(),
        source: this._sourcesMap[key] || "unknown",
      };
      current.values.push(valObj);
    }

    const convert = (node: any): ConfigurationSection => {
      const subs = Object.keys(node.subsections).map((k) =>
        convert(node.subsections[k])
      );
      return {
        path: node.path,
        values: [...node.values],
        subsections: subs,
      };
    };

    return Object.keys(root.subsections).map((k) => convert(root.subsections[k]));
  }
}
