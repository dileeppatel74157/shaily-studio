import { AgentState } from "./AgentState";

export interface AgentSnapshot {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly state: AgentState;
  readonly capabilities: ReadonlyArray<string>;
  readonly metadata: Record<string, unknown>;
  readonly timestamp: Date;
}
