export interface StudioModule {
  readonly id: string;
  readonly type: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
