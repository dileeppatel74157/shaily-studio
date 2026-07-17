export interface SkillExecutionResult {
  readonly executionId: string;
  readonly success: boolean;
  readonly output?: any;
  readonly error?: string;
  readonly runtimeMs: number;
}
