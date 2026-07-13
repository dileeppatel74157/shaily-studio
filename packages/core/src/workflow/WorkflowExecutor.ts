import { Workflow } from "./Workflow";
import { WorkflowStepStatus } from "./WorkflowStep";
import { WorkflowState } from "./WorkflowState";

export class WorkflowExecutor {
  public async execute(workflow: Workflow, signal?: AbortSignal): Promise<void> {
    workflow.start();
    workflow.context.logger.info(
      `Starting execution of workflow: ${workflow.name} (${workflow.id})`
    );

    let currentStepId: string | undefined;
    try {
      for (const step of workflow.steps) {
        if (signal?.aborted || workflow.state === WorkflowState.CANCELLED) {
          throw new Error("Workflow execution cancelled.");
        }

        currentStepId = step.id;
        workflow.updateStepStatus(step.id, WorkflowStepStatus.RUNNING);
        workflow.context.logger.info(
          `Executing step: ${step.name} (${step.id}) using agent: ${step.agentId}`
        );

        // Lookup agent
        const agent = workflow.context.agentRegistry.get(step.agentId);
        if (!agent) {
          throw new Error(`Agent with ID ${step.agentId} not found in registry.`);
        }

        // Initialize agent if not READY
        if (agent.state === "CREATED") {
          await agent.initialize();
        }

        // Execute agent with cancellation race
        let abortHandler: () => void = () => {};
        const abortPromise = new Promise<never>((_, reject) => {
          if (signal?.aborted) {
            reject(new Error("cancelled"));
            return;
          }
          abortHandler = () => reject(new Error("cancelled"));
          signal?.addEventListener("abort", abortHandler);
        });

        const output = await Promise.race([agent.execute(step.input), abortPromise]).finally(() => {
          if (signal && abortHandler) {
            signal.removeEventListener("abort", abortHandler);
          }
        });

        workflow.updateStepStatus(step.id, WorkflowStepStatus.COMPLETED, output);
        workflow.context.logger.info(`Step completed: ${step.name} (${step.id})`);
      }

      workflow.complete();
      workflow.context.logger.info(
        `Workflow completed successfully: ${workflow.name} (${workflow.id})`
      );
    } catch (err: any) {
      if (signal?.aborted || err.message?.includes("cancelled")) {
        workflow.cancel();
        workflow.context.logger.warn(`Workflow cancelled: ${workflow.name} (${workflow.id})`);
      } else {
        if (currentStepId) {
          workflow.updateStepStatus(
            currentStepId,
            WorkflowStepStatus.FAILED,
            undefined,
            err.message
          );
        }
        workflow.fail();
        workflow.context.logger.error(
          `Workflow execution failed: ${workflow.name} (${workflow.id})`,
          {},
          err
        );
        throw err; // Propagate failure
      }
    }
  }
}
