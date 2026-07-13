export interface AgentMetadata {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly capabilities: ReadonlyArray<string>;
  readonly metadata: Record<string, unknown>;
}
