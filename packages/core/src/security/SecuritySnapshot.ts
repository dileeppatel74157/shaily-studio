import { Principal } from "./Principal";
import { SecurityPolicy } from "./SecurityPolicy";
import { AuditEvent } from "./AuditEvent";

export interface SecuritySnapshot {
  readonly timestamp: Date;
  readonly principals: readonly Principal[];
  readonly policies: readonly SecurityPolicy[];
  readonly auditLog: readonly AuditEvent[];
  readonly metadata: Readonly<Record<string, unknown>>;
}
