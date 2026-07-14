import { PluginMetadata } from "./PluginMetadata";
import { PluginContext } from "./PluginContext";
import { PluginState } from "./PluginState";
import { PluginSnapshot } from "./PluginSnapshot";

export interface IPlugin {
  readonly metadata: PluginMetadata;
  readonly context: PluginContext;
  readonly state: PluginState;

  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  snapshot(): PluginSnapshot;
}
