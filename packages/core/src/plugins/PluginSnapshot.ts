import { PluginState } from "./PluginState";
import { PluginMetadata } from "./PluginMetadata";

export interface PluginSnapshot {
  readonly id: string;
  readonly state: PluginState;
  readonly metadata: PluginMetadata;
  readonly timestamp: Date;
}
