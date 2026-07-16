import { AgentTeam } from "./AgentTeam";
import { TeamMember } from "./TeamMember";
import { TeamTask } from "./TeamTask";
import { TeamExecutionResult } from "./TeamExecutionResult";
import { TeamAssignment } from "./TeamAssignment";
import { ExecutionStrategy } from "./ExecutionStrategy";
import { TaskDistributorType } from "./TaskDistributor";
import { TeamMetrics } from "./TeamMetrics";
import { AgentOrchestratorSnapshot } from "./AgentOrchestratorSnapshot";

export interface IAgentOrchestrator {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;

  createTeam(name: string, leaderId?: string): Promise<AgentTeam>;
  deleteTeam(teamId: string): Promise<boolean>;
  addMember(teamId: string, member: Omit<TeamMember, "joinedAt">): Promise<void>;
  removeMember(teamId: string, agentId: string): Promise<void>;
  selectLeader(teamId: string, leaderId: string): Promise<void>;

  distributeTasks(
    teamId: string,
    tasks: ReadonlyArray<Omit<TeamTask, "status" | "retryCount" | "assigneeId">>,
    strategy: TaskDistributorType
  ): Promise<ReadonlyArray<TeamAssignment>>;

  executeTeam(
    teamId: string,
    tasks: ReadonlyArray<TeamTask>,
    strategy: ExecutionStrategy
  ): Promise<TeamExecutionResult>;

  getMetrics(teamId: string): Promise<TeamMetrics>;
  snapshot(): AgentOrchestratorSnapshot;
}
