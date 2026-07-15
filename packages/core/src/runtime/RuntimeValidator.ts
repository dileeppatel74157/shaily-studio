import { RuntimeSessionDescriptor } from "./RuntimeSessionDescriptor";
import { RuntimeContext } from "./RuntimeContext";
import { RuntimeValidationException } from "./types";

export class RuntimeValidator {
  private static readonly ID_REGEX = /^[a-zA-Z0-9_.-]+$/;

  public static validateIdentifier(id: string, name: string): void {
    if (!id || typeof id !== "string" || id.trim() === "") {
      throw new RuntimeValidationException(`${name} identifier must be a non-empty string`);
    }
    if (!this.ID_REGEX.test(id)) {
      throw new RuntimeValidationException(
        `${name} identifier "${id}" contains invalid characters. Only alphanumeric, dots, dashes, and underscores are allowed.`
      );
    }
  }

  public static validateContext(context: RuntimeContext): void {
    if (!context) {
      throw new RuntimeValidationException("RuntimeContext cannot be null or undefined");
    }
    this.validateIdentifier(context.env, "Context environment (env)");
    this.validateIdentifier(context.namespace, "Context namespace");
  }

  public static validateDescriptor(descriptor: RuntimeSessionDescriptor): void {
    if (!descriptor) {
      throw new RuntimeValidationException("RuntimeSessionDescriptor cannot be null or undefined");
    }
    this.validateIdentifier(descriptor.id, "Session ID");
  }
}
