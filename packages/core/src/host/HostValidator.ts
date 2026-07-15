import { HostedService } from "./HostedService";
import { HostContext } from "./HostContext";
import { HostValidationException } from "./types";

export class HostValidator {
  private static readonly ID_REGEX = /^[a-zA-Z0-9_.-]+$/;

  public static validateIdentifier(id: string, name: string): void {
    if (!id || typeof id !== "string" || id.trim() === "") {
      throw new HostValidationException(`${name} identifier must be a non-empty string`);
    }
    if (!this.ID_REGEX.test(id)) {
      throw new HostValidationException(
        `${name} identifier "${id}" contains invalid characters. Only alphanumeric, dots, dashes, and underscores are allowed.`
      );
    }
  }

  public static validateContext(context: HostContext): void {
    if (!context) {
      throw new HostValidationException("HostContext cannot be null or undefined");
    }
    this.validateIdentifier(context.env, "Context environment (env)");
    this.validateIdentifier(context.namespace, "Context namespace");
  }

  public static validateService(service: HostedService): void {
    if (!service) {
      throw new HostValidationException("HostedService cannot be null or undefined");
    }
    this.validateIdentifier(service.id, "Service ID");
    if (!service.initialize || typeof service.initialize !== "function") {
      throw new HostValidationException(`Service "${service.id}" initialize method is invalid`);
    }
    if (!service.start || typeof service.start !== "function") {
      throw new HostValidationException(`Service "${service.id}" start method is invalid`);
    }
    if (!service.stop || typeof service.stop !== "function") {
      throw new HostValidationException(`Service "${service.id}" stop method is invalid`);
    }
  }
}
