export interface AgentProfile {
  readonly id: string;
  readonly avatarUrl?: string;
  readonly settings?: Record<string, unknown>;
}
