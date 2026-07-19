export interface SchedulePolicy {
  readonly maxRetries: number;
  readonly backoffMs: number;
  readonly concurrencyLimit: number;
}
