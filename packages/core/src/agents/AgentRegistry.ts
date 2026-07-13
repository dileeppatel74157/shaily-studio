import { IAgent } from "./IAgent";
import { AgentRegistrySnapshot } from "./types";

export class AgentRegistry {
  private readonly _agents = new Map<string, IAgent>();

  public register(agent: IAgent): void {
    if (this._agents.has(agent.id)) {
      throw new Error(`Agent with ID ${agent.id} is already registered.`);
    }
    this._agents.set(agent.id, agent);
  }

  public unregister(agentId: string): boolean {
    return this._agents.delete(agentId);
  }

  public get(agentId: string): IAgent | undefined {
    return this._agents.get(agentId);
  }

  public has(agentId: string): boolean {
    return this._agents.has(agentId);
  }

  public async execute(agentId: string, input?: unknown): Promise<unknown> {
    const agent = this._agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent with ID ${agentId} is not registered.`);
    }
    return agent.execute(input);
  }

  public snapshot(): AgentRegistrySnapshot {
    const snapshots = Array.from(this._agents.values()).map((a) => a.snapshot());
    return Object.freeze({
      timestamp: new Date(),
      count: snapshots.length,
      agents: Object.freeze(snapshots),
    });
  }
}
