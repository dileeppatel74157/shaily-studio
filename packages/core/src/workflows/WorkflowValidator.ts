import { WorkflowDefinition } from "./WorkflowDefinition";
import { WorkflowStep, WorkflowStepType } from "./WorkflowStep";
import { WorkflowValidationException } from "./types";

export class WorkflowValidator {
  public static validate(definition: WorkflowDefinition): void {
    if (!definition.id || definition.id.trim() === "") {
      throw new WorkflowValidationException("Workflow ID cannot be empty.");
    }
    if (!definition.name || definition.name.trim() === "") {
      throw new WorkflowValidationException("Workflow name cannot be empty.");
    }
    if (!definition.steps || definition.steps.length === 0) {
      throw new WorkflowValidationException(`Workflow "${definition.id}" must contain at least one step.`);
    }

    const stepIds = new Set<string>();
    this.validateSteps(definition.steps, stepIds);

    // Check variables
    if (definition.variables) {
      const varNames = new Set(definition.variables.map((v) => v.name));
      for (const step of definition.steps) {
        this.validateStepVariables(step, varNames);
      }
    }
  }

  private static validateSteps(
    steps: readonly WorkflowStep[],
    stepIds: Set<string>,
    visitedSteps = new Set<any>()
  ): void {
    for (const step of steps) {
      if (!step.id || step.id.trim() === "") {
        throw new WorkflowValidationException("Workflow step ID cannot be empty.");
      }
      if (stepIds.has(step.id)) {
        throw new WorkflowValidationException(`Duplicate step ID "${step.id}" detected.`);
      }
      stepIds.add(step.id);

      if (visitedSteps.has(step)) {
        throw new WorkflowValidationException(`Circular step reference detected at step "${step.id}".`);
      }
      visitedSteps.add(step);

      // Recursively validate child steps
      if (step.type === WorkflowStepType.CONDITIONAL_BRANCH) {
        if (step.thenSteps) {
          this.validateSteps(step.thenSteps, stepIds, new Set(visitedSteps));
        }
        if (step.elseSteps) {
          this.validateSteps(step.elseSteps, stepIds, new Set(visitedSteps));
        }
      } else if (step.type === WorkflowStepType.LOOP) {
        if (step.loopSteps) {
          this.validateSteps(step.loopSteps, stepIds, new Set(visitedSteps));
        }
      } else if (step.type === WorkflowStepType.PARALLEL_BRANCH) {
        if (step.parallelBranches) {
          for (const branch of step.parallelBranches) {
            this.validateSteps(branch, stepIds, new Set(visitedSteps));
          }
        }
      } else if (step.type === WorkflowStepType.SEQUENTIAL_BRANCH) {
        if (step.sequentialSteps) {
          this.validateSteps(step.sequentialSteps, stepIds, new Set(visitedSteps));
        }
      }
    }
  }

  private static validateStepVariables(step: WorkflowStep, declaredVars: Set<string>): void {
    if (step.assignments) {
      for (const assign of step.assignments) {
        if (!declaredVars.has(assign.variableName)) {
          throw new WorkflowValidationException(
            `Step "${step.id}" assigns to undeclared variable "${assign.variableName}".`
          );
        }
      }
    }

    if (step.conditions) {
      for (const cond of step.conditions) {
        if (!declaredVars.has(cond.variableName)) {
          throw new WorkflowValidationException(
            `Step "${step.id}" references undeclared variable "${cond.variableName}" in condition.`
          );
        }
      }
    }

    if (step.thenSteps) {
      for (const sub of step.thenSteps) this.validateStepVariables(sub, declaredVars);
    }
    if (step.elseSteps) {
      for (const sub of step.elseSteps) this.validateStepVariables(sub, declaredVars);
    }
    if (step.loopSteps) {
      for (const sub of step.loopSteps) this.validateStepVariables(sub, declaredVars);
    }
    if (step.parallelBranches) {
      for (const branch of step.parallelBranches) {
        for (const sub of branch) this.validateStepVariables(sub, declaredVars);
      }
    }
    if (step.sequentialSteps) {
      for (const sub of step.sequentialSteps) this.validateStepVariables(sub, declaredVars);
    }
  }
}
