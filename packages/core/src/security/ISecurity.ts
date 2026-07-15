import { Credential } from "./Credential";
import { AuthToken } from "./AuthToken";
import { AccessDecision } from "./AccessDecision";
import { SecuritySnapshot } from "./SecuritySnapshot";

export interface ISecurity {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  authenticate(credential: Credential): Promise<AuthToken>;
  authorize(token: AuthToken, permissionId: string): Promise<AccessDecision>;
  encrypt(plaintext: string): Promise<string>;
  decrypt(ciphertext: string): Promise<string>;
  audit(
    action: string,
    principalId: string | undefined,
    status: "SUCCESS" | "FAILURE",
    details: Record<string, unknown>
  ): void;
  snapshot(): SecuritySnapshot;
}
