import { Workflow } from "./Workflow";
import { InvalidWorkflowException } from "./types";

export class WorkflowValidator {
  public validate(workflow: Workflow): void {
    if (!workflow.id || workflow.id.trim() === "") {
      throw new InvalidWorkflowException("Workflow ID cannot be empty.");
    }
    if (!workflow.name || workflow.name.trim() === "") {
      throw new InvalidWorkflowException("Workflow name cannot be empty.");
    }
    if (!workflow.version || workflow.version.trim() === "") {
      throw new InvalidWorkflowException("Workflow version cannot be empty.");
    }

    if (workflow.steps.length === 0) {
      throw new InvalidWorkflowException("Workflow must have at least one step.");
    }

    for (const step of workflow.steps) {
      if (!step.id || step.id.trim() === "") {
        throw new InvalidWorkflowException("Step ID cannot be empty.");
      }
      if (!step.name || step.name.trim() === "") {
        throw new InvalidWorkflowException("Step name cannot be empty.");
      }
      if ((!step.agentId || step.agentId.trim() === "") && (!step.skillId || step.skillId.trim() === "")) {
        throw new InvalidWorkflowException(`Step ${step.id} has neither Agent ID nor Skill ID.`);
      }
      if (step.priority === undefined || step.priority < 0) {
        throw new InvalidWorkflowException(`Step ${step.id} has invalid priority.`);
      }
    }
  }
}
