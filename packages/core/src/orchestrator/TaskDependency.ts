export interface TaskDependency {
  readonly taskId: string;
  readonly dependsOnTaskId: string;
}
