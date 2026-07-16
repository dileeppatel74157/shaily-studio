export enum WorkflowTriggerType {
  MANUAL = "MANUAL",
  EVENT = "EVENT",
  SCHEDULE = "SCHEDULE",
}

export interface WorkflowTrigger {
  readonly type: WorkflowTriggerType;
  readonly eventName?: string;
  readonly cronExpression?: string;
}
