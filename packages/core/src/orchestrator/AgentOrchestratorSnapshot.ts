import { AgentOrchestratorState } from "./AgentOrchestratorState";
import { AgentTeam } from "./AgentTeam";
import { TeamExecution } from "./TeamExecution";
import { TeamAssignment } from "./TeamAssignment";
import { TeamMetrics } from "./TeamMetrics";

export interface AgentOrchestratorSnapshot {
  readonly timestamp: Date;
  readonly state: AgentOrchestratorState;
  readonly teams: ReadonlyArray<AgentTeam>;
  readonly executions: ReadonlyArray<TeamExecution>;
  readonly assignments: ReadonlyArray<TeamAssignment>;
  readonly metrics: Record<string, TeamMetrics>;
  readonly timelines: ReadonlyArray<any>;
}
