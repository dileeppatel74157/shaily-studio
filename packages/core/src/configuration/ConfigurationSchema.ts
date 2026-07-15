export interface ConfigurationSchemaItem {
  readonly type: "string" | "number" | "boolean" | "enum";
  readonly required: boolean;
  readonly default?: unknown;
  readonly enumValues?: readonly string[];
}

export type ConfigurationSchema = Record<string, ConfigurationSchemaItem>;
// Alias/Interface for exporting schema in the snapshot
export interface ConfigurationSchemaSnapshot {
  readonly [key: string]: ConfigurationSchemaItem;
}
