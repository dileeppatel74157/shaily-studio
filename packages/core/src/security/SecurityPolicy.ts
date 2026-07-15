import { Role } from "./Role";
import { Permission } from "./Permission";

export interface SecurityPolicy {
  readonly id: string;
  readonly roles: readonly Role[];
  readonly permissions: readonly Permission[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}
