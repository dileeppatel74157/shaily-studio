import { IWorkflowEngine } from "./IWorkflowEngine";
import { Workflow } from "./Workflow";
import { WorkflowEngineSnapshot } from "./types";
import { WorkflowExecutor } from "./WorkflowExecutor";
import { WorkflowValidator } from "./WorkflowValidator";
import { WorkflowState } from "./WorkflowState";

export class WorkflowEngine implements IWorkflowEngine {
  private readonly _workflows = new Map<string, Workflow>();
  private readonly _activeExecutions = new Map<string, AbortController>();
  private readonly _executor = new WorkflowExecutor();
  private readonly _validator = new WorkflowValidator();

  public register(workflow: Workflow): void {
    if (this._workflows.has(workflow.id)) {
      throw new Error(`Workflow with ID ${workflow.id} is already registered.`);
    }
    this._validator.validate(workflow);
    this._workflows.set(workflow.id, workflow);
  }

  public unregister(workflowId: string): boolean {
    this.cancel(workflowId); // Abort execution if active
    return this._workflows.delete(workflowId);
  }

  public get(workflowId: string): Workflow | undefined {
    return this._workflows.get(workflowId);
  }

  public has(workflowId: string): boolean {
    return this._workflows.has(workflowId);
  }

  public async execute(workflowId: string): Promise<unknown> {
    const workflow = this._workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow with ID ${workflowId} is not registered.`);
    }

    if (workflow.state === WorkflowState.RUNNING) {
      throw new Error(`Workflow ${workflowId} is already running.`);
    }

    const controller = new AbortController();
    this._activeExecutions.set(workflowId, controller);

    try {
      await this._executor.execute(workflow, controller.signal);
      const snap = workflow.snapshot();
      const lastStep = snap.steps[snap.steps.length - 1];
      return lastStep?.output;
    } finally {
      this._activeExecutions.delete(workflowId);
    }
  }

  public async cancel(workflowId: string): Promise<boolean> {
    const controller = this._activeExecutions.get(workflowId);
    if (controller) {
      controller.abort();
      const workflow = this._workflows.get(workflowId);
      if (workflow) {
        workflow.cancel();
      }
      return true;
    }

    const workflow = this._workflows.get(workflowId);
    if (workflow && workflow.state === WorkflowState.READY) {
      workflow.cancel();
      return true;
    }

    return false;
  }

  public snapshot(): WorkflowEngineSnapshot {
    const snaps = Array.from(this._workflows.values()).map((w) => w.snapshot());
    return Object.freeze({
      timestamp: new Date(),
      count: snaps.length,
      workflows: Object.freeze(snaps),
    });
  }
}
