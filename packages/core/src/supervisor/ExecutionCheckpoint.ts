export interface ExecutionCheckpoint {
  readonly id: string;
  readonly sessionId: string;
  readonly timestamp: Date;
  readonly variables: Record<string, unknown>;
  readonly workflowState?: any;
  readonly planningState?: any;
  readonly agentState?: any;
  readonly progress: number;
}
