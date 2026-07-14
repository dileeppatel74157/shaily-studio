import { IPlugin } from "./IPlugin";
import { PluginRegistrySnapshot } from "./PluginRegistry";

export interface IPluginRegistry {
  register(plugin: IPlugin): void;
  unregister(pluginId: string): boolean;
  get(pluginId: string): IPlugin | undefined;
  has(pluginId: string): boolean;
  snapshot(): PluginRegistrySnapshot;
}
