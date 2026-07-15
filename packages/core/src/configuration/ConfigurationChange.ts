export interface ConfigurationChange {
  readonly key: string;
  readonly oldValue: unknown;
  readonly newValue: unknown;
  readonly timestamp: Date;
}
