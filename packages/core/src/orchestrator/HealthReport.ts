import { AgentPerformance } from "./AgentPerformance";

export interface HealthReport {
  readonly timestamp: Date;
  readonly agentStatus: ReadonlyArray<AgentPerformance>;
  readonly overloadedAgents: ReadonlyArray<string>;
}
