export interface Credential {
  readonly type: string;
  readonly value: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
