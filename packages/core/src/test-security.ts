import { SecurityBuilder } from "./security/SecurityBuilder";
import { SecurityContext } from "./security/SecurityContext";
import { SecurityPolicy } from "./security/SecurityPolicy";
import { HealthStatus } from "./observability/HealthStatus";
import { Credential } from "./security/Credential";
import { AuthToken } from "./security/AuthToken";
import { Permission } from "./security/Permission";
import { Role } from "./security/Role";
import { SecurityValidator } from "./security/SecurityValidator";
import { EncryptionProvider } from "./security/EncryptionProvider";
import { SecurityState } from "./security/SecurityState";
import {
  SecurityException,
  SecurityValidationException,
  InvalidSecurityStateException,
  AuthenticationException,
  AuthorizationException,
} from "./security/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    // eslint-disable-next-line no-console
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

// Custom Encryption Provider for testing custom delegation
class CustomReverseEncryptionProvider implements EncryptionProvider {
  public async encrypt(plaintext: string): Promise<string> {
    return plaintext.split("").reverse().join("");
  }
  public async decrypt(ciphertext: string): Promise<string> {
    return ciphertext.split("").reverse().join("");
  }
}

async function runTests() {
  // eslint-disable-next-line no-console
  console.log("=== START SECURITY FRAMEWORK VERIFICATION TESTS ===");

  const context: SecurityContext = {
    env: "staging",
    tenantId: "tenant-1",
    metadata: { version: "1.0.0" },
  };

  const readPerm: Permission = { id: "data.read", description: "Read data" };
  const writePerm: Permission = { id: "data.write", description: "Write data" };

  const adminRole: Role = {
    id: "admin",
    permissions: [readPerm, writePerm],
  };

  const userRole: Role = {
    id: "user",
    permissions: [readPerm],
  };

  const policy: SecurityPolicy = {
    id: "default-policy",
    permissions: [readPerm, writePerm],
    roles: [adminRole, userRole],
  };

  // ==========================================
  // 1. Builder Validation
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("1. Running Builder Validation...");

  // Valid construction
  const sec = new SecurityBuilder()
    .withContext(context)
    .withPolicy(policy)
    .withMetadata({ module: "user-management" })
    .build();
  assert(sec !== null, "Security instance must be successfully constructed");

  // Invalid construction (missing context)
  try {
    new SecurityBuilder().withPolicy(policy).build();
    throw new Error("Should have rejected build with missing context");
  } catch (err: unknown) {
    assert(
      err instanceof SecurityValidationException,
      "Expected SecurityValidationException for missing context"
    );
  }

  // Invalid construction (missing policy)
  try {
    new SecurityBuilder().withContext(context).build();
    throw new Error("Should have rejected build with missing policy");
  } catch (err: unknown) {
    assert(
      err instanceof SecurityValidationException,
      "Expected SecurityValidationException for missing policy"
    );
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified Builder Validation.");

  // ==========================================
  // 2. Lifecycle State Transitions
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("2. Running Lifecycle Transition Validation...");

  const testSec = new SecurityBuilder().withContext(context).withPolicy(policy).build();

  // Try calling runtime operation in CREATED state
  try {
    await testSec.encrypt("secret");
    throw new Error("Should have prevented encrypt in CREATED state");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidSecurityStateException,
      "Expected InvalidSecurityStateException for CREATED state"
    );
  }

  // CREATED -> READY
  await testSec.initialize();

  // Try illegal transition READY -> STOPPED
  try {
    await testSec.stop();
    throw new Error("Should have prevented READY -> STOPPED");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidSecurityStateException,
      "Expected InvalidSecurityStateException for READY -> STOPPED"
    );
  }

  // READY -> RUNNING
  await testSec.start();

  // Try illegal transition RUNNING -> READY
  try {
    await testSec.initialize();
    throw new Error("Should have prevented RUNNING -> READY");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidSecurityStateException,
      "Expected InvalidSecurityStateException for RUNNING -> READY"
    );
  }

  // RUNNING -> STOPPED
  await testSec.stop();

  // Once stopped, operations must fail
  try {
    await testSec.encrypt("secret");
    throw new Error("Should have prevented encrypt in STOPPED state");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidSecurityStateException,
      "Expected InvalidSecurityStateException for STOPPED state"
    );
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified Lifecycle State Transition and exception rules.");

  // ==========================================
  // 3. Authentication
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("3. Running Authentication Validation...");

  const activeSec = new SecurityBuilder().withContext(context).withPolicy(policy).build();
  await activeSec.initialize();
  await activeSec.start();

  // Test successful API Key authentication
  const apiToken = await activeSec.authenticate({
    type: "apiKey",
    value: "valid-key-123",
  });
  assert(apiToken.token.length > 0, "AuthToken must contain generated token string");
  assert(apiToken.principal.id === "admin-user", "Principal ID matches admin-user");
  assert(apiToken.principal.roles.includes("admin"), "Roles contain admin");
  assert(apiToken.principal.metadata.department === "IT", "Principal metadata preserved");

  // Test successful Password authentication
  const userToken = await activeSec.authenticate({
    type: "password",
    value: "password123",
  });
  assert(userToken.principal.id === "standard-user", "Principal ID matches standard-user");
  assert(userToken.principal.roles.includes("user"), "Roles contain user");

  // Test invalid authentication credentials
  try {
    await activeSec.authenticate({
      type: "password",
      value: "wrong-password",
    });
    throw new Error("Should have rejected wrong credentials");
  } catch (err: unknown) {
    assert(
      err instanceof AuthenticationException,
      "Expected AuthenticationException for wrong password"
    );
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified successful and rejected authentication workflows.");

  // ==========================================
  // 4. Authorization (RBAC / ABAC)
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("4. Running Authorization Validation...");

  // Test Admin authorization (possesses both read and write)
  const adminReadDecision = await activeSec.authorize(apiToken, "data.read");
  assert(adminReadDecision.allowed === true, "Admin should be allowed to read");
  assert(adminReadDecision.principalId === "admin-user", "Matches principal ID");
  assert(adminReadDecision.permissionId === "data.read", "Matches permission ID");

  const adminWriteDecision = await activeSec.authorize(apiToken, "data.write");
  assert(adminWriteDecision.allowed === true, "Admin should be allowed to write");

  // Test Standard User authorization (possesses read, but NOT write)
  const userReadDecision = await activeSec.authorize(userToken, "data.read");
  assert(userReadDecision.allowed === true, "Standard user should be allowed to read");

  const userWriteDecision = await activeSec.authorize(userToken, "data.write");
  assert(userWriteDecision.allowed === false, "Standard user must be denied write access");
  assert(
    userWriteDecision.reason.includes("denied"),
    "Decision reason should document denial reason"
  );

  // Test invalid/expired token authorization
  const invalidToken: AuthToken = {
    token: "fake-token-id",
    principal: { id: "hack", roles: ["admin"], metadata: {} },
    issuedAt: new Date(),
    expiresAt: new Date(Date.now() + 10000),
  };
  try {
    await activeSec.authorize(invalidToken, "data.read");
    throw new Error("Should have rejected authorization for unregistered token");
  } catch (err: unknown) {
    assert(
      err instanceof AuthorizationException,
      "Expected AuthorizationException for unregistered token"
    );
  }

  // Test expired token
  const expiredToken: AuthToken = {
    token: apiToken.token,
    principal: apiToken.principal,
    issuedAt: apiToken.issuedAt,
    expiresAt: new Date(Date.now() - 5000), // Expired 5 seconds ago
  };

  // We manually modify active token entry to simulate expiration
  const activeTokensMap = (activeSec as any)._activeTokens;
  activeTokensMap.set(apiToken.token, expiredToken);

  try {
    await activeSec.authorize(apiToken, "data.read");
    throw new Error("Should have rejected authorization for expired token");
  } catch (err: unknown) {
    assert(
      err instanceof AuthorizationException,
      "Expected AuthorizationException for expired token"
    );
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified policy-based permission authorization and validation rules.");

  // ==========================================
  // 5. Encryption Delegation
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("5. Running Encryption Delegation Validation...");

  // Default provider (Base64)
  const plainText = "Antigravity is amazing!";
  const encryptedBase64 = await activeSec.encrypt(plainText);
  assert(encryptedBase64 !== plainText, "Encrypted text should differ from plaintext");
  assert(encryptedBase64 === Buffer.from(plainText).toString("base64"), "Should use Base64 by default");

  const decryptedBase64 = await activeSec.decrypt(encryptedBase64);
  assert(decryptedBase64 === plainText, "Decrypted text should match original plaintext");

  // Custom Provider Injection
  const customSec = new SecurityBuilder()
    .withContext(context)
    .withPolicy(policy)
    .withEncryptionProvider(new CustomReverseEncryptionProvider())
    .build();
  await customSec.initialize();
  await customSec.start();

  const customEnc = await customSec.encrypt(plainText);
  assert(customEnc === plainText.split("").reverse().join(""), "Custom provider reverse works");

  const customDec = await customSec.decrypt(customEnc);
  assert(customDec === plainText, "Custom provider reverse decrypt works");
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified Encryption Provider mock and custom delegation workflows.");

  // ==========================================
  // 6. Audit Logging
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("6. Running Audit Logging Validation...");

  // Check audit records on activeSec snapshot
  const activeSnapshot = activeSec.snapshot();
  const logs = activeSnapshot.auditLog;
  
  assert(logs.length > 0, "Audit logs must capture operations");

  // Check authenticate log
  const authLog = logs.find((l) => l.action === "authenticate" && l.status === "SUCCESS");
  assert(authLog !== undefined, "Auth success log exists");
  assert(authLog!.principalId === "admin-user", "Log records principal ID");

  // Check authorize log
  const authDenyLog = logs.find(
    (l) => l.action === "authorize" && l.status === "FAILURE" && l.details.permissionId === "data.write"
  );
  assert(authDenyLog !== undefined, "Auth deny log exists");
  assert(authDenyLog!.principalId === "standard-user", "Standard user deny principal tracked");

  // Check encrypt/decrypt log
  const encryptLog = logs.find((l) => l.action === "encrypt");
  assert(encryptLog !== undefined, "Encrypt operation logged");

  // eslint-disable-next-line no-console
  console.log("   ✓ Verified Audit Logging tracking success/failure events.");

  // ==========================================
  // 7. Policy Validation
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("7. Running Policy Validation Checks...");

  // Policy: Duplicate Permissions
  try {
    const duplicatePermPolicy: SecurityPolicy = {
      id: "invalid-policy",
      permissions: [readPerm, readPerm], // Duplicate permission ID!
      roles: [],
    };
    SecurityValidator.validatePolicy(duplicatePermPolicy);
    throw new Error("Should have rejected duplicate permissions list");
  } catch (err: unknown) {
    assert(
      err instanceof SecurityValidationException,
      "Expected SecurityValidationException for duplicate permissions"
    );
  }

  // Policy: Duplicate Roles
  try {
    const duplicateRolePolicy: SecurityPolicy = {
      id: "invalid-policy",
      permissions: [readPerm],
      roles: [userRole, userRole], // Duplicate role ID!
    };
    SecurityValidator.validatePolicy(duplicateRolePolicy);
    throw new Error("Should have rejected duplicate roles list");
  } catch (err: unknown) {
    assert(
      err instanceof SecurityValidationException,
      "Expected SecurityValidationException for duplicate roles"
    );
  }

  // Policy: Role references missing permission
  try {
    const missingPermRole: Role = {
      id: "guest",
      permissions: [{ id: "unknown.permission", description: "Unknown" }],
    };
    const invalidRefPolicy: SecurityPolicy = {
      id: "invalid-policy",
      permissions: [readPerm],
      roles: [missingPermRole], // References permission not in permissions list!
    };
    SecurityValidator.validatePolicy(invalidRefPolicy);
    throw new Error("Should have rejected policy with undefined role permission references");
  } catch (err: unknown) {
    assert(
      err instanceof SecurityValidationException,
      "Expected SecurityValidationException for undefined role permission references"
    );
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified policy configurations rules.");

  // ==========================================
  // 8. Snapshot Immutability
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("8. Running Snapshot Immutability Validation...");

  // Modify snapshot timestamp
  try {
    (activeSnapshot as any).timestamp = new Date(0);
    throw new Error("Should have thrown error on modifying snapshot root");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Expected TypeError on modifying frozen snapshot");
  }

  // Modify auditLog array
  try {
    (activeSnapshot.auditLog as any)[0] = null;
    throw new Error("Should have thrown error on modifying snapshot auditLog array");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Expected TypeError on modifying frozen auditLog array");
  }

  // Modify policy structure
  try {
    (activeSnapshot.policies[0] as any).id = "hacked-policy";
    throw new Error("Should have thrown error on modifying snapshot policies");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Expected TypeError on modifying frozen policy");
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified deep freeze immutability on snapshots, policies, and audit logs.");

  // ==========================================
  // 9. Validator Rules
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("9. Running Validator Rule Checks...");

  // Invalid identifiers
  try {
    SecurityValidator.validateIdentifier("invalid ID with space", "Test ID");
    throw new Error("Should have rejected space in identifier");
  } catch (err: unknown) {
    assert(
      err instanceof SecurityValidationException,
      "Expected SecurityValidationException for spaces in identifier"
    );
  }

  try {
    SecurityValidator.validateIdentifier("invalid_id_@_char", "Test ID");
    throw new Error("Should have rejected special symbol in identifier");
  } catch (err: unknown) {
    assert(
      err instanceof SecurityValidationException,
      "Expected SecurityValidationException for special symbol in identifier"
    );
  }

  // Invalid credentials
  try {
    SecurityValidator.validateCredential({ type: "", value: "pass" });
    throw new Error("Should have rejected empty credential type");
  } catch (err: unknown) {
    assert(
      err instanceof SecurityValidationException,
      "Expected SecurityValidationException for empty credential type"
    );
  }

  try {
    SecurityValidator.validateCredential({ type: "apiKey", value: "  " });
    throw new Error("Should have rejected empty credential value");
  } catch (err: unknown) {
    assert(
      err instanceof SecurityValidationException,
      "Expected SecurityValidationException for empty credential value"
    );
  }
  // eslint-disable-next-line no-console
  console.log("   ✓ Verified validator rule constraints.");

  // eslint-disable-next-line no-console
  console.log("=== ALL SECURITY FRAMEWORK VERIFICATION TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Test execution failed:", err);
  process.exit(1);
});
