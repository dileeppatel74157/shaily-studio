import { AgentState } from "./AgentState";
import { AgentSnapshot } from "./AgentSnapshot";

export interface IBaseAgent {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly state: AgentState;

  initialize(): Promise<void>;
  start(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  execute(task?: unknown): Promise<unknown>;
  snapshot(): AgentSnapshot;
}
