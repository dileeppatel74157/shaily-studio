import { ProviderMetadata } from "./ProviderMetadata";
import { ProviderValidationException } from "./types";

export class ProviderValidator {
  public validateMetadata(metadata: ProviderMetadata): void {
    if (!metadata.id || metadata.id.trim() === "") {
      throw new ProviderValidationException("Provider ID cannot be empty.");
    }
    if (!metadata.name || metadata.name.trim() === "") {
      throw new ProviderValidationException("Provider name cannot be empty.");
    }
    if (!metadata.version || metadata.version.trim() === "") {
      throw new ProviderValidationException("Provider version cannot be empty.");
    }
    if (!metadata.capabilities) {
      throw new ProviderValidationException("Provider capabilities must be specified.");
    }
  }
}
