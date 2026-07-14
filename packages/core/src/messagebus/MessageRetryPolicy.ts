export interface MessageRetryPolicy {
  readonly maxRetries: number;
  readonly delay: number;
  readonly exponential: boolean;
  readonly backoff: number;
}
