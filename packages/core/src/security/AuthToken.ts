import { Principal } from "./Principal";

export interface AuthToken {
  readonly token: string;
  readonly principal: Principal;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
}
