import { ConfigSnapshot } from "./ConfigSnapshot";

export interface IConfig {
  get<T>(key: string): T;
  has(key: string): boolean;
  snapshot(): ConfigSnapshot;
  reload(): Promise<void>;
  validate(): void;
}
