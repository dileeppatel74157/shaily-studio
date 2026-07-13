import { WorkflowState } from "./WorkflowState";
import { WorkflowStep, WorkflowStepStatus } from "./WorkflowStep";
import { WorkflowContext } from "./WorkflowContext";
import { WorkflowSnapshot } from "./WorkflowSnapshot";
import { InvalidWorkflowStateException } from "./types";

export class Workflow {
  private _state: WorkflowState = WorkflowState.CREATED;
  private readonly _steps: WorkflowStep[];

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly version: string,
    public readonly description: string,
    steps: WorkflowStep[],
    public readonly metadata: Record<string, unknown>,
    public readonly context: WorkflowContext
  ) {
    this._steps = steps.map((step) => ({ ...step }));
  }

  public get state(): WorkflowState {
    return this._state;
  }

  public get steps(): ReadonlyArray<WorkflowStep> {
    return this._steps;
  }

  public start(): void {
    this.ensureMutable("start");
    this._state = WorkflowState.RUNNING;
  }

  public complete(): void {
    this.ensureMutable("complete");
    this._state = WorkflowState.COMPLETED;
    this.freeze();
  }

  public fail(): void {
    this.ensureMutable("fail");
    this._state = WorkflowState.FAILED;
    this.freeze();
  }

  public cancel(): void {
    this.ensureMutable("cancel");
    this._state = WorkflowState.CANCELLED;
    // Mark pending or running steps as cancelled
    for (const step of this._steps) {
      if (
        step.status === WorkflowStepStatus.PENDING ||
        step.status === WorkflowStepStatus.RUNNING
      ) {
        step.status = WorkflowStepStatus.CANCELLED;
      }
    }
    this.freeze();
  }

  public updateStepStatus(
    stepId: string,
    status: WorkflowStepStatus,
    output?: unknown,
    error?: string
  ): void {
    this.ensureMutable("updateStepStatus");
    const step = this._steps.find((s) => s.id === stepId);
    if (!step) {
      throw new Error(`Step with ID ${stepId} not found in workflow ${this.id}`);
    }
    step.status = status;
    if (output !== undefined) {
      step.output = JSON.parse(JSON.stringify(output));
    }
    if (error !== undefined) {
      step.error = error;
    }
  }

  public snapshot(): WorkflowSnapshot {
    const stepSnaps = this._steps.map((step) =>
      Object.freeze({
        id: step.id,
        name: step.name,
        agentId: step.agentId,
        priority: step.priority,
        input: step.input ? JSON.parse(JSON.stringify(step.input)) : undefined,
        output: step.output ? JSON.parse(JSON.stringify(step.output)) : undefined,
        status: step.status,
        error: step.error,
      })
    );

    return Object.freeze({
      id: this.id,
      name: this.name,
      version: this.version,
      description: this.description,
      state: this._state,
      metadata: Object.freeze(JSON.parse(JSON.stringify(this.metadata))),
      steps: Object.freeze(stepSnaps),
      timestamp: new Date(),
    });
  }

  private ensureMutable(action: string): void {
    if (
      this._state === WorkflowState.COMPLETED ||
      this._state === WorkflowState.FAILED ||
      this._state === WorkflowState.CANCELLED
    ) {
      throw new InvalidWorkflowStateException(this.id, action, this._state);
    }
  }

  private freeze(): void {
    Object.freeze(this);
    Object.freeze(this._steps);
    for (const step of this._steps) {
      Object.freeze(step);
    }
    if (this.metadata) {
      Object.freeze(this.metadata);
    }
  }
}
