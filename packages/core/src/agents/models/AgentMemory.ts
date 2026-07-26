export interface AgentMemory {
  readonly id: string;
  readonly key: string;
  readonly value: unknown;
  readonly type: "short-term" | "long-term" | "episodic" | "semantic";
  readonly timestamp: Date;
}
