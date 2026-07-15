export interface AuditEvent {
  readonly id: string;
  readonly action: string;
  readonly principalId?: string;
  readonly status: "SUCCESS" | "FAILURE";
  readonly details: Readonly<Record<string, unknown>>;
  readonly timestamp: Date;
}
