export interface PlanDependency {
  readonly taskId: string;
  readonly dependsOnTaskId: string;
}
