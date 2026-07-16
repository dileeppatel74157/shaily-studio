import { IAgent } from "./IAgent";
import { AgentRegistrySnapshot, deepFreeze } from "./types";
import { IAgentRegistry } from "./IAgentRegistry";

export class AgentRegistry implements IAgentRegistry {
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

  public list(): IAgent[] {
    return Array.from(this._agents.values());
  }

  public async execute(agentId: string, input?: unknown): Promise<unknown> {
    const agent = this._agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent with ID ${agentId} is not registered.`);
    }
    return agent.execute(input);
  }

  public async broadcast(input: unknown): Promise<Record<string, unknown>> {
    const results: Record<string, unknown> = {};
    const promises = Array.from(this._agents.entries()).map(async ([id, agent]) => {
      try {
        const res = await agent.execute(input);
        results[id] = res;
      } catch (err: any) {
        results[id] = { error: err.message };
      }
    });
    await Promise.all(promises);
    return results;
  }

  public snapshot(): AgentRegistrySnapshot {
    const snapshots = Array.from(this._agents.values()).map((a) => a.snapshot());
    return deepFreeze({
      timestamp: new Date(),
      count: snapshots.length,
      agents: snapshots,
    });
  }
}
