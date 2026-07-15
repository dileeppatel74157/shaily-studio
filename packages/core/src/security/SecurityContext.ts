export interface SecurityContext {
  readonly env: string;
  readonly tenantId: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}
