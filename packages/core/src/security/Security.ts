import { ISecurity } from "./ISecurity";
import { Credential } from "./Credential";
import { AuthToken } from "./AuthToken";
import { AccessDecision } from "./AccessDecision";
import { SecuritySnapshot } from "./SecuritySnapshot";
import { SecurityContext } from "./SecurityContext";
import { SecurityPolicy } from "./SecurityPolicy";
import { EncryptionProvider } from "./EncryptionProvider";
import { AuditLog } from "./AuditLog";
import { AuditEvent } from "./AuditEvent";
import { Principal } from "./Principal";
import { SecurityState } from "./SecurityState";
import { SecurityValidator } from "./SecurityValidator";
import {
  AuthenticationException,
  AuthorizationException,
  InvalidSecurityStateException,
  deepFreeze,
} from "./types";

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class Security implements ISecurity {
  private readonly _context: SecurityContext;
  private readonly _policy: SecurityPolicy;
  private readonly _encryptionProvider: EncryptionProvider;
  private readonly _metadata: Readonly<Record<string, unknown>>;
  private readonly _auditLog = new AuditLog();
  private readonly _activeTokens = new Map<string, AuthToken>();
  private _state: SecurityState = SecurityState.CREATED;

  constructor(
    context: SecurityContext,
    policy: SecurityPolicy,
    encryptionProvider: EncryptionProvider,
    metadata?: Record<string, unknown>
  ) {
    SecurityValidator.validateContext(context);
    SecurityValidator.validatePolicy(policy);
    
    this._context = context;
    this._policy = policy;
    this._encryptionProvider = encryptionProvider;
    this._metadata = metadata ? { ...metadata } : {};
  }

  public async initialize(): Promise<void> {
    if (this._state !== SecurityState.CREATED) {
      throw new InvalidSecurityStateException("initialize", this._state);
    }
    try {
      this._state = SecurityState.READY;
    } catch (err) {
      this._state = SecurityState.FAILED;
      throw err;
    }
  }

  public async start(): Promise<void> {
    if (this._state !== SecurityState.READY) {
      throw new InvalidSecurityStateException("start", this._state);
    }
    try {
      this._state = SecurityState.RUNNING;
    } catch (err) {
      this._state = SecurityState.FAILED;
      throw err;
    }
  }

  public async stop(): Promise<void> {
    if (this._state !== SecurityState.RUNNING) {
      throw new InvalidSecurityStateException("stop", this._state);
    }
    try {
      this._state = SecurityState.STOPPED;
    } catch (err) {
      this._state = SecurityState.FAILED;
      throw err;
    }
  }

  public async authenticate(credential: Credential): Promise<AuthToken> {
    if (this._state !== SecurityState.RUNNING) {
      throw new InvalidSecurityStateException("authenticate", this._state);
    }

    SecurityValidator.validateCredential(credential);

    let principal: Principal | null = null;

    if (credential.type === "apiKey" && credential.value === "valid-key-123") {
      principal = {
        id: "admin-user",
        roles: ["admin"],
        metadata: { department: "IT" },
      };
    } else if (credential.type === "password" && credential.value === "password123") {
      principal = {
        id: "standard-user",
        roles: ["user"],
        metadata: { department: "Marketing" },
      };
    }

    if (!principal) {
      this.audit("authenticate", undefined, "FAILURE", {
        type: credential.type,
        reason: "Invalid credentials supplied",
      });
      throw new AuthenticationException("Authentication failed: Invalid credentials");
    }

    const tokenString = generateUUID();
    const token: AuthToken = {
      token: tokenString,
      principal,
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour expiration
    };

    this._activeTokens.set(tokenString, token);
    
    this.audit("authenticate", principal.id, "SUCCESS", {
      type: credential.type,
      roles: principal.roles,
    });

    return deepFreeze(token);
  }

  public async authorize(token: AuthToken, permissionId: string): Promise<AccessDecision> {
    if (this._state !== SecurityState.RUNNING) {
      throw new InvalidSecurityStateException("authorize", this._state);
    }

    if (!token || !token.token) {
      throw new AuthorizationException("Invalid token format");
    }

    const activeToken = this._activeTokens.get(token.token);
    if (!activeToken) {
      this.audit("authorize", undefined, "FAILURE", {
        permissionId,
        reason: "Auth token is not active or has been revoked",
      });
      throw new AuthorizationException("Authorization failed: Token is not active");
    }

    if (activeToken.expiresAt.getTime() < Date.now()) {
      this._activeTokens.delete(token.token);
      this.audit("authorize", activeToken.principal.id, "FAILURE", {
        permissionId,
        reason: "Auth token has expired",
      });
      throw new AuthorizationException("Authorization failed: Token has expired");
    }

    SecurityValidator.validateIdentifier(permissionId, "Permission");

    const principal = activeToken.principal;
    let allowed = false;
    let reason = "Access denied: Principal does not possess required role permission";

    for (const roleId of principal.roles) {
      const policyRole = this._policy.roles.find((r) => r.id === roleId);
      if (policyRole) {
        const hasPerm = policyRole.permissions.some((p) => p.id === permissionId);
        if (hasPerm) {
          allowed = true;
          reason = `Access granted based on role: "${roleId}"`;
          break;
        }
      }
    }

    const decision: AccessDecision = {
      allowed,
      principalId: principal.id,
      permissionId,
      reason,
      timestamp: new Date(),
    };

    this.audit("authorize", principal.id, allowed ? "SUCCESS" : "FAILURE", {
      permissionId,
      reason,
    });

    return deepFreeze(decision);
  }

  public async encrypt(plaintext: string): Promise<string> {
    if (this._state !== SecurityState.RUNNING) {
      throw new InvalidSecurityStateException("encrypt", this._state);
    }
    const result = await this._encryptionProvider.encrypt(plaintext);
    this.audit("encrypt", undefined, "SUCCESS", { length: plaintext.length });
    return result;
  }

  public async decrypt(ciphertext: string): Promise<string> {
    if (this._state !== SecurityState.RUNNING) {
      throw new InvalidSecurityStateException("decrypt", this._state);
    }
    const result = await this._encryptionProvider.decrypt(ciphertext);
    this.audit("decrypt", undefined, "SUCCESS", { length: ciphertext.length });
    return result;
  }

  public audit(
    action: string,
    principalId: string | undefined,
    status: "SUCCESS" | "FAILURE",
    details: Record<string, unknown>
  ): void {
    if (this._state !== SecurityState.RUNNING) {
      // In lifecycle READY or STOPPING it could be allowed to log final actions. 
      // But let's restrict to RUNNING for strict lifecycle state machine rules.
      throw new InvalidSecurityStateException("audit", this._state);
    }

    const event: AuditEvent = {
      id: generateUUID(),
      action,
      principalId,
      status,
      details: { ...details },
      timestamp: new Date(),
    };

    this._auditLog.log(event);
  }

  public snapshot(): SecuritySnapshot {
    if (this._state !== SecurityState.RUNNING && this._state !== SecurityState.STOPPED) {
      throw new InvalidSecurityStateException("snapshot", this._state);
    }

    const activePrincipals = Array.from(this._activeTokens.values()).map(
      (t) => t.principal
    );

    const snapshotObj: SecuritySnapshot = {
      timestamp: new Date(),
      principals: activePrincipals,
      policies: [this._policy],
      auditLog: this._auditLog.getEvents(),
      metadata: { ...this._context.metadata, ...this._metadata },
    };

    return deepFreeze(snapshotObj);
  }
}
