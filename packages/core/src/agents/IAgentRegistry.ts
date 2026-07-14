import { IAgent } from "./IAgent";
import { AgentRegistrySnapshot } from "./types";

export interface IAgentRegistry {
  register(agent: IAgent): void;
  unregister(agentId: string): boolean;
  get(agentId: string): IAgent | undefined;
  has(agentId: string): boolean;
  snapshot(): AgentRegistrySnapshot;
}
