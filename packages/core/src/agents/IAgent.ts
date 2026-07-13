import { AgentState } from "./AgentState";
import { AgentContext } from "./AgentContext";
import { AgentSnapshot } from "./AgentSnapshot";

export interface IAgent {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly state: AgentState;
  readonly capabilities: ReadonlyArray<string>;
  readonly metadata: Record<string, unknown>;
  readonly context: AgentContext;

  initialize(): Promise<void>;
  execute(input?: unknown): Promise<unknown>;
  shutdown(): Promise<void>;
  snapshot(): AgentSnapshot;
}
