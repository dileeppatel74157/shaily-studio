export interface OrchestratorRequest {
  readonly requestId: string;
  readonly taskName: string;
  readonly input: unknown;
  readonly workflowId?: string;
  readonly agentId?: string;
  readonly priority?: number;
  readonly metadata?: Record<string, unknown>;
}
