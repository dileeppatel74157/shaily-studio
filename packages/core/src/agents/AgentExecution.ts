import { AgentState } from "./AgentState";

export interface AgentExecution {
  readonly id: string;
  readonly agentId: string;
  readonly taskId?: string;
  readonly status: AgentState;
  readonly input?: unknown;
  readonly output?: unknown;
  readonly error?: string;
  readonly startTime: Date;
  readonly endTime?: Date;
}
