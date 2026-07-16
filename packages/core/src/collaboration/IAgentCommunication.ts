import { AgentMessage } from "./AgentMessage";
import { AgentPresence, AgentPresenceStatus } from "./AgentPresence";
import { AgentTaskAssignment } from "./AgentTaskAssignment";
import { AgentConversationThread } from "./AgentConversationThread";
import { AgentCollaborationReport } from "./AgentCollaborationReport";
import { AgentCommunicationSnapshot } from "./AgentCommunicationSnapshot";

export interface IAgentCommunication {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;

  send(message: Omit<AgentMessage, "id" | "status" | "timestamp">): Promise<AgentMessage>;
  reply(replyToMessageId: string, replyContent: string): Promise<AgentMessage>;
  receive(agentId: string): Promise<ReadonlyArray<AgentMessage>>;
  acknowledge(messageId: string): Promise<void>;
  reject(messageId: string): Promise<void>;
  complete(messageId: string): Promise<void>;

  delegate(
    assignment: Omit<AgentTaskAssignment, "id" | "status" | "progress" | "createdAt" | "updatedAt">
  ): Promise<AgentTaskAssignment>;
  accept(taskId: string): Promise<void>;
  rejectTask(taskId: string): Promise<void>;
  completeTask(taskId: string): Promise<void>;
  cancelTask(taskId: string): Promise<void>;
  progressTask(taskId: string, progress: number): Promise<void>;

  broadcast(
    message: Omit<AgentMessage, "id" | "status" | "timestamp" | "recipientId" | "conversationId">,
    recipientIds: ReadonlyArray<string>
  ): Promise<void>;
  multicast(
    message: Omit<AgentMessage, "id" | "status" | "timestamp" | "recipientId" | "conversationId">,
    recipientIds: ReadonlyArray<string>
  ): Promise<void>;
  unicast(message: Omit<AgentMessage, "id" | "status" | "timestamp">): Promise<void>;

  presence(agentId: string, status: AgentPresenceStatus): Promise<void>;
  heartbeat(agentId: string): Promise<void>;
  conversationHistory(conversationId: string): Promise<AgentConversationThread>;

  generateReport(): AgentCollaborationReport;
  snapshot(): AgentCommunicationSnapshot;
}
