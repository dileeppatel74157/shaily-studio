import { Workflow } from "./Workflow";
import { WorkflowStep, WorkflowStepStatus } from "./WorkflowStep";
import { WorkflowContext } from "./WorkflowContext";

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class WorkflowBuilder {
  private _id = generateUUID();
  private _name?: string;
  private _version = "1.0.0";
  private _description = "";
  private _steps: WorkflowStep[] = [];
  private _metadata: Record<string, unknown> = {};
  private _context?: WorkflowContext;

  public withId(id: string): this {
    this._id = id;
    return this;
  }

  public withName(name: string): this {
    this._name = name;
    return this;
  }

  public withVersion(version: string): this {
    this._version = version;
    return this;
  }

  public withDescription(description: string): this {
    this._description = description;
    return this;
  }

  public addStep(step: Omit<WorkflowStep, "status"> & { status?: WorkflowStepStatus }): this {
    this._steps.push({
      ...step,
      status: step.status ?? WorkflowStepStatus.PENDING,
    });
    return this;
  }

  public withMetadata(metadata: Record<string, unknown>): this {
    this._metadata = { ...metadata };
    return this;
  }

  public withContext(context: WorkflowContext): this {
    this._context = context;
    return this;
  }

  public build(): Workflow {
    if (!this._name) {
      throw new Error("Workflow name is required to build a Workflow.");
    }
    if (!this._context) {
      throw new Error("Workflow context is required to build a Workflow.");
    }
    if (this._steps.length === 0) {
      throw new Error("Workflow must have at least one step to build a Workflow.");
    }

    return new Workflow(
      this._id,
      this._name,
      this._version,
      this._description,
      this._steps,
      this._metadata,
      this._context
    );
  }
}
