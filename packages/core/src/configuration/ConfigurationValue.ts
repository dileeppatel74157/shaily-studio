export interface ConfigurationValue {
  readonly key: string;
  readonly value: unknown;
  readonly timestamp: Date;
  readonly source: string;
}
