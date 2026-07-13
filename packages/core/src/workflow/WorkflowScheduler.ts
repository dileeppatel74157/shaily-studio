import { Workflow } from "./Workflow";
import { WorkflowEngine } from "./WorkflowEngine";

/**
 * WorkflowScheduler handles scheduling workflows.
 *
 * Current specification:
 * - Immediate execution only.
 *
 * Design for delayed scheduling (DO NOT implement):
 * - To support delayed scheduling, the scheduler would:
 *   1. Maintain a queue of workflows with target trigger times.
 *   2. Run a polling timer loop to check for matured schedules.
 *   3. Dispatch matured schedules to the WorkflowEngine.
 */
export class WorkflowScheduler {
  constructor(private readonly _engine: WorkflowEngine) {}

  public async schedule(workflow: Workflow): Promise<void> {
    await this._engine.execute(workflow.id);
  }

  public async scheduleDelayed(workflow: Workflow, _delayMs: number): Promise<void> {
    throw new Error("Delayed scheduling is not supported in Sprint 4.1.");
  }
}
