export type WorkflowVariableType = "string" | "number" | "boolean" | "object" | "array";

export interface WorkflowVariable {
  readonly name: string;
  readonly type: WorkflowVariableType;
  readonly defaultValue?: any;
  readonly description?: string;
  readonly required?: boolean;
}
