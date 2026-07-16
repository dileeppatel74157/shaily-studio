import { WorkflowDefinition } from "./WorkflowDefinition";
import { WorkflowValidator } from "./WorkflowValidator";
import { WorkflowValidationException, deepFreeze } from "./types";

export class WorkflowRegistry {
  private readonly _workflows = new Map<string, WorkflowDefinition>();

  public register(workflow: WorkflowDefinition): void {
    if (this._workflows.has(workflow.id)) {
      throw new WorkflowValidationException(`Workflow with ID "${workflow.id}" is already registered.`);
    }
    WorkflowValidator.validate(workflow);
    // Clone and deep freeze definition on registration to guarantee immutability
    const clone = JSON.parse(JSON.stringify(workflow));
    this._workflows.set(workflow.id, deepFreeze(clone));
  }

  public unregister(workflowId: string): boolean {
    return this._workflows.delete(workflowId);
  }

  public get(workflowId: string): WorkflowDefinition | undefined {
    return this._workflows.get(workflowId);
  }

  public has(workflowId: string): boolean {
    return this._workflows.has(workflowId);
  }

  public list(): readonly WorkflowDefinition[] {
    return Array.from(this._workflows.values());
  }

  public getIds(): readonly string[] {
    return Array.from(this._workflows.keys());
  }
}
