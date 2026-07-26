export type ConfigValueType = "string" | "number" | "boolean" | "enum";

export interface SchemaProperty {
  readonly type: ConfigValueType;
  readonly required?: boolean;
  readonly default?: unknown;
  readonly enumValues?: string[];
}

export interface ConfigSchema {
  readonly [key: string]: SchemaProperty;
}
