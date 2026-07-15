import { BootstrapManifest } from "./BootstrapManifest";
import { BootstrapModule } from "./BootstrapModule";
import { BootstrapContext } from "./BootstrapContext";
import { BootstrapValidationException } from "./types";

export class BootstrapValidator {
  private static readonly ID_REGEX = /^[a-zA-Z0-9_.-]+$/;

  public static validateIdentifier(id: string, name: string): void {
    if (!id || typeof id !== "string" || id.trim() === "") {
      throw new BootstrapValidationException(`${name} identifier must be a non-empty string`);
    }
    if (!this.ID_REGEX.test(id)) {
      throw new BootstrapValidationException(
        `${name} identifier "${id}" contains invalid characters. Only alphanumeric, dots, dashes, and underscores are allowed.`
      );
    }
  }

  public static validateContext(context: BootstrapContext): void {
    if (!context) {
      throw new BootstrapValidationException("BootstrapContext cannot be null or undefined");
    }
    this.validateIdentifier(context.env, "Context environment (env)");
    this.validateIdentifier(context.namespace, "Context namespace");
  }

  public static validateManifest(manifest: BootstrapManifest): void {
    if (!manifest) {
      throw new BootstrapValidationException("BootstrapManifest cannot be null or undefined");
    }
    if (!manifest.version || typeof manifest.version !== "string" || manifest.version.trim() === "") {
      throw new BootstrapValidationException("Manifest version must be a non-empty string");
    }
    if (!manifest.modules || !Array.isArray(manifest.modules)) {
      throw new BootstrapValidationException("Manifest modules list must be an array");
    }

    const uniqueIds = new Set<string>();
    manifest.modules.forEach((mod) => {
      this.validateModule(mod);
      if (uniqueIds.has(mod.id)) {
        throw new BootstrapValidationException(`Duplicate module ID found in manifest: "${mod.id}"`);
      }
      uniqueIds.add(mod.id);
    });
  }

  public static validateModule(module: BootstrapModule): void {
    if (!module) {
      throw new BootstrapValidationException("BootstrapModule cannot be null or undefined");
    }
    this.validateIdentifier(module.id, "Module ID");
    if (!module.dependencies || !Array.isArray(module.dependencies)) {
      throw new BootstrapValidationException(`Module "${module.id}" must declare dependencies as an array`);
    }
    module.dependencies.forEach((dep) => {
      this.validateIdentifier(dep, `Module "${module.id}" dependency`);
    });
  }
}
