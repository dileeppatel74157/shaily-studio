export interface StorageBucket {
  readonly id: string;
  readonly name: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
