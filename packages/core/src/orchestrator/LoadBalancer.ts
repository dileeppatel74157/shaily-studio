import { AgentPerformance } from "./AgentPerformance";

export class LoadBalancer {
  public static selectHealthiest(agents: ReadonlyArray<AgentPerformance>): string | undefined {
    if (agents.length === 0) return undefined;
    const sorted = [...agents].sort((a, b) => {
      if (b.successRate !== a.successRate) {
        return b.successRate - a.successRate;
      }
      if (a.activeTasksCount !== b.activeTasksCount) {
        return a.activeTasksCount - b.activeTasksCount;
      }
      return a.cpuLoad - b.cpuLoad;
    });
    return sorted[0].agentId;
  }
}
