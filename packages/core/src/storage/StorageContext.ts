export interface StorageContext {
  readonly env: string;
  readonly namespace: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}
