export interface AgentPerformance {
  readonly agentId: string;
  readonly cpuLoad: number;
  readonly activeTasksCount: number;
  readonly averageResponseTimeMs: number;
  readonly successRate: number;
}
