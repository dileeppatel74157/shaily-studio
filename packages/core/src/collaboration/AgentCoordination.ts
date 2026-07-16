export interface AgentCoordination {
  readonly id: string;
  readonly teamId: string;
  readonly leaderId: string;
  readonly followerIds: ReadonlyArray<string>;
  readonly state: "forming" | "active" | "completed" | "disbanded";
  readonly metadata: Record<string, unknown>;
  readonly timestamp: Date;
}
