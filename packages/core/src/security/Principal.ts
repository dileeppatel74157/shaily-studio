export interface Principal {
  readonly id: string;
  readonly roles: readonly string[];
  readonly metadata: Readonly<Record<string, unknown>>;
}
