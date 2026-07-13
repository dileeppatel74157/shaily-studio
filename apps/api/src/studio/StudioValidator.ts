import { StudioMetadata } from "./StudioMetadata";
import { StudioValidationException } from "./types";

export class StudioValidator {
  public validateMetadata(metadata: StudioMetadata): void {
    if (!metadata.id || metadata.id.trim() === "") {
      throw new StudioValidationException("Studio ID cannot be empty.");
    }
    if (!metadata.version || metadata.version.trim() === "") {
      throw new StudioValidationException("Studio version cannot be empty.");
    }
    if (!metadata.environment || metadata.environment.trim() === "") {
      throw new StudioValidationException("Studio environment cannot be empty.");
    }
  }
}
