import { PluginCapability } from "./PluginCapability";

export interface PluginMetadata {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly author: string;
  readonly description: string;
  readonly capabilities: readonly PluginCapability[];
}
