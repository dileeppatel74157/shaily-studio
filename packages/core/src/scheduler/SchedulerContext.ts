export interface SchedulerContext {
  readonly env: string;
  readonly namespace: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}
