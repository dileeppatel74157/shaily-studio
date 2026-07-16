export interface PlanReflection {
  readonly id: string;
  readonly planId: string;
  readonly taskId: string;
  readonly success: boolean;
  readonly lessons: string;
  readonly retryNeeded: boolean;
  readonly replanNeeded: boolean;
  readonly timestamp: Date;
}
