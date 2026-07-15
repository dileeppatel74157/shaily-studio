import { Permission } from "./Permission";

export interface Role {
  readonly id: string;
  readonly permissions: readonly Permission[];
}
