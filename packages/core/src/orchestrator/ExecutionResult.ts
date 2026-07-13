export interface ExecutionResult {
  readonly executionId: string;
  readonly success: boolean;
  readonly output?: unknown;
  readonly errors?: ReadonlyArray<string>;
  readonly duration: number; // in milliseconds
}
