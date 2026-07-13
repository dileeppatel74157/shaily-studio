export type TaskStatus = "pending" | "running" | "completed" | "failed";

export interface AgentMetadata {
  id: string;
  name: string;
  role: string;
  description: string;
  version: string;
  capabilities: string[];
}

export interface TaskPayload {
  taskId: string;
  agentId: string;
  inputData: Record<string, unknown>;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
}

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}
