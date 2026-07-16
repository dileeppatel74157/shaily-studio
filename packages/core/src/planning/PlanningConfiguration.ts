export interface PlanningConfiguration {
  readonly maxPlanningRetries?: number;
  readonly timeoutMs?: number;
  readonly dynamicReplanningEnabled?: boolean;
  readonly reflectionEnabled?: boolean;
}
