export interface BootstrapModule {
  readonly id: string;
  readonly dependencies: readonly string[];
  readonly enabled: boolean;
  readonly config?: Readonly<Record<string, unknown>>;
}
