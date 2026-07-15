import { Permission } from "./Permission";
import { Role } from "./Role";
import { SecurityPolicy } from "./SecurityPolicy";
import { Credential } from "./Credential";
import { SecurityContext } from "./SecurityContext";
import { SecurityValidationException } from "./types";

export class SecurityValidator {
  private static readonly ID_REGEX = /^[a-zA-Z0-9_.-]+$/;

  public static validateIdentifier(id: string, name: string): void {
    if (!id || typeof id !== "string" || id.trim() === "") {
      throw new SecurityValidationException(`${name} identifier must be a non-empty string`);
    }
    if (!this.ID_REGEX.test(id)) {
      throw new SecurityValidationException(
        `${name} identifier "${id}" contains invalid characters. Only alphanumeric, dots, dashes, and underscores are allowed.`
      );
    }
  }

  public static validateContext(context: SecurityContext): void {
    if (!context) {
      throw new SecurityValidationException("SecurityContext cannot be null or undefined");
    }
    this.validateIdentifier(context.env, "Context environment (env)");
    this.validateIdentifier(context.tenantId, "Context tenant ID (tenantId)");
  }

  public static validatePolicy(policy: SecurityPolicy): void {
    if (!policy) {
      throw new SecurityValidationException("SecurityPolicy cannot be null or undefined");
    }
    this.validateIdentifier(policy.id, "Policy");

    const permissionIds = new Set<string>();
    for (const perm of policy.permissions) {
      if (!perm) {
        throw new SecurityValidationException("Policy permission cannot be null or undefined");
      }
      this.validateIdentifier(perm.id, "Permission");
      if (permissionIds.has(perm.id)) {
        throw new SecurityValidationException(`Duplicate permission ID detected in policy: "${perm.id}"`);
      }
      permissionIds.add(perm.id);
    }

    const roleIds = new Set<string>();
    for (const role of policy.roles) {
      if (!role) {
        throw new SecurityValidationException("Policy role cannot be null or undefined");
      }
      this.validateIdentifier(role.id, "Role");
      if (roleIds.has(role.id)) {
        throw new SecurityValidationException(`Duplicate role ID detected in policy: "${role.id}"`);
      }
      roleIds.add(role.id);

      const rolePermIds = new Set<string>();
      for (const rolePerm of role.permissions) {
        if (!rolePerm) {
          throw new SecurityValidationException(`Role "${role.id}" has a null/undefined permission`);
        }
        this.validateIdentifier(rolePerm.id, `Role "${role.id}" permission`);
        if (rolePermIds.has(rolePerm.id)) {
          throw new SecurityValidationException(`Duplicate permission ID "${rolePerm.id}" in role "${role.id}"`);
        }
        rolePermIds.add(rolePerm.id);

        if (!permissionIds.has(rolePerm.id)) {
          throw new SecurityValidationException(
            `Role "${role.id}" references permission "${rolePerm.id}" which is not defined in the policy's permissions list`
          );
        }
      }
    }
  }

  public static validateCredential(credential: Credential): void {
    if (!credential) {
      throw new SecurityValidationException("Credential cannot be null or undefined");
    }
    if (!credential.type || typeof credential.type !== "string" || credential.type.trim() === "") {
      throw new SecurityValidationException("Credential type is required and must be a non-empty string");
    }
    if (!credential.value || typeof credential.value !== "string" || credential.value.trim() === "") {
      throw new SecurityValidationException("Credential value is required and must be a non-empty string");
    }
  }
}
