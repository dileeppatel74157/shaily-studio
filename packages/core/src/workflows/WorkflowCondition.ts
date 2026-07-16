export enum WorkflowConditionOperator {
  EQUALS = "EQUALS",
  NOT_EQUALS = "NOT_EQUALS",
  GREATER_THAN = "GREATER_THAN",
  LESS_THAN = "LESS_THAN",
  CONTAINS = "CONTAINS",
  EXISTS = "EXISTS",
}

export interface WorkflowCondition {
  readonly variableName: string;
  readonly operator: WorkflowConditionOperator;
  readonly value?: any;
}
