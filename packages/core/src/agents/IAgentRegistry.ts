import { IAgent } from "./IAgent";
import { AgentRegistrySnapshot } from "./types";

export interface IAgentRegistry {
  register(agent: IAgent): void;
  unregister(agentId: string): boolean;
  get(agentId: string): IAgent | undefined;
  has(agentId: string): boolean;
  list(): IAgent[];
  execute(agentId: string, input?: unknown): Promise<unknown>;
  broadcast(input: unknown): Promise<Record<string, unknown>>;
  snapshot(): AgentRegistrySnapshot;
}
