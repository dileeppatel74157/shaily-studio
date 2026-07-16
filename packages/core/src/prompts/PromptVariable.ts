export interface PromptVariable {
  readonly name: string;
  readonly type: "string" | "number" | "boolean" | "json" | "array";
  readonly required: boolean;
  readonly defaultValue?: any;
  readonly description?: string;
}
