import { ConfigurationChange } from "./ConfigurationChange";

export type ConfigurationWatcherCallback = (changes: readonly ConfigurationChange[]) => void;

export class ConfigurationWatcher {
  private readonly _callbacks = new Map<string, ConfigurationWatcherCallback>();

  public watch(callback: ConfigurationWatcherCallback): string {
    const id = "watcher-" + Math.random().toString(36).substring(2, 11);
    this._callbacks.set(id, callback);
    return id;
  }

  public unwatch(watcherId: string): boolean {
    return this._callbacks.delete(watcherId);
  }

  public notify(changes: readonly ConfigurationChange[]): void {
    if (changes.length === 0) return;
    this._callbacks.forEach((callback) => {
      try {
        callback(changes);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in configuration watcher callback:", err);
      }
    });
  }

  public clear(): void {
    this._callbacks.clear();
  }
}
