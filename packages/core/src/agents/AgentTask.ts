export interface AgentTask {
  readonly id: string;
  readonly description: string;
  readonly input?: unknown;
  readonly priority?: number;
  readonly deadline?: Date;
}
