export interface ExecutionFailure {
  readonly message: string;
  readonly stack?: string;
  readonly code?: string;
  readonly timestamp: Date;
}
