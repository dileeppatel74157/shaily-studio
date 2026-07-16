export interface AIExecutionOptions {
  readonly timeout?: number;
  readonly retries?: number;
  readonly priority?: number;
  readonly routingStrategy?: string;
  readonly bypassSecurity?: boolean;
  readonly correlationId?: string;
  readonly causationId?: string;
}
