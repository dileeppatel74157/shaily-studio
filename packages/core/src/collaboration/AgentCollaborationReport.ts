import { AgentMessage } from "./AgentMessage";
import { AgentTaskAssignment } from "./AgentTaskAssignment";

export interface AgentCollaborationReport {
  readonly timestamp: Date;
  readonly messages: ReadonlyArray<AgentMessage>;
  readonly tasks: ReadonlyArray<AgentTaskAssignment>;
  readonly completedTasksCount: number;
  readonly failedTasksCount: number;
  readonly broadcastCount: number;
  readonly delegationsCount: number;
  readonly onlineAgentsCount: number;
  readonly statistics: Record<string, unknown>;
}
