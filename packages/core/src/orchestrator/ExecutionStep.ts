export enum ExecutionStepType {
  AGENT = "AGENT",
  WORKFLOW = "WORKFLOW",
  LLM_ROUTE = "LLM_ROUTE",
}

export interface ExecutionStep {
  readonly id: string;
  readonly name: string;
  readonly type: ExecutionStepType;
  readonly targetId: string; // agentId, workflowId, or modelId/empty
  readonly input: unknown;
}
