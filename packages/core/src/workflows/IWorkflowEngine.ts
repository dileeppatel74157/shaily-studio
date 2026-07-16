import { WorkflowDefinition } from "./WorkflowDefinition";
import { WorkflowExecutionResult } from "./WorkflowExecutionResult";
import { WorkflowSnapshot } from "./WorkflowSnapshot";

export interface IWorkflowEngine {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  register(workflow: WorkflowDefinition): Promise<void>;
  unregister(workflowId: string): Promise<void>;
  execute(
    workflowId: string,
    input?: Record<string, unknown>
  ): Promise<WorkflowExecutionResult>;
  has(workflowId: string): boolean;
  get(workflowId: string): WorkflowDefinition | undefined;
  list(): readonly WorkflowDefinition[];
  snapshot(): WorkflowSnapshot;
}
