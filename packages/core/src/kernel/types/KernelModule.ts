export interface KernelModule {
  readonly id: string;
  readonly dependencies: readonly string[];
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
}
