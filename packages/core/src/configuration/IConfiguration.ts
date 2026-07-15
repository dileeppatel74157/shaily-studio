import { ConfigurationProvider } from "./ConfigurationProvider";
import { ConfigurationSnapshot } from "./ConfigurationSnapshot";
import { ConfigurationChange } from "./ConfigurationChange";
import { ConfigurationWatcherCallback } from "./ConfigurationWatcher";

export interface IConfiguration {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  get<T>(key: string): T;
  set(key: string, value: unknown): Promise<void>;
  has(key: string): boolean;
  remove(key: string): Promise<void>;
  registerProvider(provider: ConfigurationProvider): Promise<void>;
  unregisterProvider(name: string): Promise<void>;
  reload(): Promise<void>;
  snapshot(): ConfigurationSnapshot;
  watch(callback: ConfigurationWatcherCallback): string;
  unwatch(watcherId: string): boolean;
}
