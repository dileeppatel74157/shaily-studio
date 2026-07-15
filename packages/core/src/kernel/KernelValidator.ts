import { KernelModule } from "./KernelModule";
import { KernelContext } from "./KernelContext";
import { KernelValidationException } from "./types";

export class KernelValidator {
  private static readonly ID_REGEX = /^[a-zA-Z0-9_.-]+$/;

  public static validateIdentifier(id: string, name: string): void {
    if (!id || typeof id !== "string" || id.trim() === "") {
      throw new KernelValidationException(`${name} identifier must be a non-empty string`);
    }
    if (!this.ID_REGEX.test(id)) {
      throw new KernelValidationException(
        `${name} identifier "${id}" contains invalid characters. Only alphanumeric, dots, dashes, and underscores are allowed.`
      );
    }
  }

  public static validateContext(context: KernelContext): void {
    if (!context) {
      throw new KernelValidationException("KernelContext cannot be null or undefined");
    }
    this.validateIdentifier(context.env, "Context environment (env)");
    this.validateIdentifier(context.namespace, "Context namespace");
  }

  public static validateModule(module: KernelModule): void {
    if (!module) {
      throw new KernelValidationException("KernelModule cannot be null or undefined");
    }
    this.validateIdentifier(module.id, "Module ID");
    if (!module.dependencies || !Array.isArray(module.dependencies)) {
      throw new KernelValidationException(`Module "${module.id}" must declare dependencies as an array`);
    }
    module.dependencies.forEach((dep) => {
      this.validateIdentifier(dep, `Module "${module.id}" dependency`);
    });
  }
}
