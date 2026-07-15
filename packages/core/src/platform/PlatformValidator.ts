import { PlatformManifest } from "./PlatformManifest";
import { PlatformContext } from "./PlatformContext";
import { PlatformValidationException } from "./types";

export class PlatformValidator {
  public static validateManifest(manifest: PlatformManifest): void {
    if (!manifest) {
      throw new PlatformValidationException("Manifest cannot be null or undefined.");
    }
    this.validateIdentifier(manifest.id, "Manifest ID");
    this.validateNonEmpty(manifest.name, "Manifest Name");
    this.validateVersion(manifest.version, "Manifest Version");
    this.validateNonEmpty(manifest.description, "Manifest Description");
    this.validateNonEmpty(manifest.environment, "Manifest Environment");
    this.validateNonEmpty(manifest.build, "Manifest Build");

    if (!Array.isArray(manifest.features)) {
      throw new PlatformValidationException("Manifest features must be a read-only array of strings.");
    }
    for (const feat of manifest.features) {
      this.validateNonEmpty(feat, "Manifest Feature");
    }

    if (manifest.metadata === null || typeof manifest.metadata !== "object") {
      throw new PlatformValidationException("Manifest metadata must be an object.");
    }
    for (const [key, val] of Object.entries(manifest.metadata)) {
      this.validateIdentifier(key, "Metadata Key");
      if (val === null || val === undefined || (typeof val === "string" && val.trim() === "")) {
        throw new PlatformValidationException(`Metadata value for key "${key}" cannot be empty.`);
      }
    }
  }

  public static validateContext(context: PlatformContext): void {
    if (!context) {
      throw new PlatformValidationException("Context cannot be null or undefined.");
    }
    this.validateNonEmpty(context.environment, "Context Environment");
    this.validateIdentifier(context.instanceId, "Context Instance ID");
    this.validateNonEmpty(context.startedBy, "Context Started By");
    this.validateNonEmpty(context.workingDirectory, "Context Working Directory");

    if (!Array.isArray(context.arguments)) {
      throw new PlatformValidationException("Context arguments must be a read-only array.");
    }
    if (context.variables === null || typeof context.variables !== "object") {
      throw new PlatformValidationException("Context variables must be an object.");
    }
  }

  public static validateMetadata(metadata: Record<string, unknown>): void {
    if (!metadata) {
      throw new PlatformValidationException("Metadata cannot be null.");
    }
    for (const [key, val] of Object.entries(metadata)) {
      this.validateIdentifier(key, "Metadata Key");
      if (val === null || val === undefined || (typeof val === "string" && val.trim() === "")) {
        throw new PlatformValidationException(`Metadata value for key "${key}" cannot be empty.`);
      }
    }
  }

  public static validateIdentifier(id: string, name: string): void {
    if (!id || id.trim() === "") {
      throw new PlatformValidationException(`${name} identifier cannot be empty.`);
    }
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(id)) {
      throw new PlatformValidationException(
        `${name} identifier "${id}" must contain only alphanumeric characters, underscores, dashes, or dots.`
      );
    }
  }

  public static validateVersion(version: string, name: string): void {
    if (!version || version.trim() === "") {
      throw new PlatformValidationException(`${name} cannot be empty.`);
    }
    if (!/^\d+\.\d+\.\d+(-\w+)?$/.test(version)) {
      throw new PlatformValidationException(
        `${name} "${version}" is not a valid semantic version string.`
      );
    }
  }

  public static validateNonEmpty(val: string, name: string): void {
    if (val === null || val === undefined || (typeof val === "string" && val.trim() === "")) {
      throw new PlatformValidationException(`${name} cannot be empty.`);
    }
  }
}
