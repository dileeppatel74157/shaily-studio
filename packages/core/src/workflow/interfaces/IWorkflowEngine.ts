import { Workflow } from "../models/Workflow";
import { WorkflowEngineSnapshot } from "../types/types";

export interface IWorkflowEngine {
  register(workflow: Workflow): void;
  unregister(workflowId: string): boolean;
  execute(workflowId: string): Promise<unknown>;
  cancel(workflowId: string): Promise<boolean>;
  get(workflowId: string): Workflow | undefined;
  has(workflowId: string): boolean;
  snapshot(): WorkflowEngineSnapshot;
}
