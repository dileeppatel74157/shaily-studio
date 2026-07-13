import { WorkflowSnapshot } from "./WorkflowSnapshot";

export class WorkflowException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidWorkflowStateException extends WorkflowException {
  constructor(workflowId: string, action: string, currentState: string) {
    super(
      `Cannot perform "${action}" on workflow "${workflowId}" because it is currently in state "${currentState}".`
    );
  }
}

export class InvalidWorkflowException extends WorkflowException {
  constructor(message: string) {
    super(message);
  }
}

export interface WorkflowEngineSnapshot {
  readonly timestamp: Date;
  readonly count: number;
  readonly workflows: ReadonlyArray<WorkflowSnapshot>;
}
