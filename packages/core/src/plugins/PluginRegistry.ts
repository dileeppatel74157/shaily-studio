import { IPlugin } from "./IPlugin";
import { PluginSnapshot } from "./PluginSnapshot";
import { PluginValidationException } from "./types";

export interface PluginRegistrySnapshot {
  readonly pluginsCount: number;
  readonly plugins: readonly PluginSnapshot[];
}

export class PluginRegistry {
  private readonly _plugins = new Map<string, IPlugin>();

  public register(plugin: IPlugin): void {
    if (this._plugins.has(plugin.metadata.id)) {
      throw new PluginValidationException(
        `Plugin with ID "${plugin.metadata.id}" is already registered.`
      );
    }
    this._plugins.set(plugin.metadata.id, plugin);
  }

  public unregister(pluginId: string): boolean {
    return this._plugins.delete(pluginId);
  }

  public get(pluginId: string): IPlugin | undefined {
    return this._plugins.get(pluginId);
  }

  public has(pluginId: string): boolean {
    return this._plugins.has(pluginId);
  }

  public async initialize(pluginId: string): Promise<void> {
    const plugin = this.getOrThrow(pluginId);
    await plugin.initialize();
  }

  public async start(pluginId: string): Promise<void> {
    const plugin = this.getOrThrow(pluginId);
    await plugin.start();
  }

  public async stop(pluginId: string): Promise<void> {
    const plugin = this.getOrThrow(pluginId);
    await plugin.stop();
  }

  public snapshot(): PluginRegistrySnapshot {
    const snapshots: PluginSnapshot[] = [];
    for (const plugin of this._plugins.values()) {
      snapshots.push(plugin.snapshot());
    }

    return Object.freeze({
      pluginsCount: this._plugins.size,
      plugins: Object.freeze(snapshots),
    });
  }

  private getOrThrow(pluginId: string): IPlugin {
    const plugin = this._plugins.get(pluginId);
    if (!plugin) {
      throw new PluginValidationException(`Plugin with ID "${pluginId}" not found.`);
    }
    return plugin;
  }
}
