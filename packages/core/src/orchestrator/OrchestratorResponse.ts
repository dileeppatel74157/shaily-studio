export interface OrchestratorResponse {
  readonly requestId: string;
  readonly success: boolean;
  readonly executionId: string;
  readonly duration: number; // in milliseconds
  readonly output?: unknown;
  readonly errors?: ReadonlyArray<string>;
  readonly metadata?: Record<string, unknown>;
}
