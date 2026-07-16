import { AgentTaskAssignment } from "./AgentTaskAssignment";

export interface AgentDelegation {
  readonly id: string;
  readonly parentTaskId?: string;
  readonly task: AgentTaskAssignment;
  readonly delegatorId: string;
  readonly delegateeId: string;
  readonly hops: number;
}
