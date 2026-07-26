export interface LoggerContext {
  readonly moduleName: string;
  readonly kernelId?: string;
  readonly requestId?: string;
  readonly jobId?: string;
  readonly correlationId?: string;
  readonly [key: string]: unknown;
}
