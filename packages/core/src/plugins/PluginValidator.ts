import { PluginMetadata } from "./PluginMetadata";
import { PluginValidationException } from "./types";
import { PluginCapability } from "./PluginCapability";

export class PluginValidator {
  public validateMetadata(metadata: PluginMetadata): void {
    if (!metadata.id || metadata.id.trim() === "") {
      throw new PluginValidationException("Plugin ID cannot be empty.");
    }
    if (!metadata.name || metadata.name.trim() === "") {
      throw new PluginValidationException("Plugin Name cannot be empty.");
    }
    if (!metadata.version || metadata.version.trim() === "") {
      throw new PluginValidationException("Plugin Version cannot be empty.");
    }
    if (!metadata.author || metadata.author.trim() === "") {
      throw new PluginValidationException("Plugin Author cannot be empty.");
    }
    if (!metadata.description || metadata.description.trim() === "") {
      throw new PluginValidationException("Plugin Description cannot be empty.");
    }
    if (!metadata.capabilities || metadata.capabilities.length === 0) {
      throw new PluginValidationException("Plugin capabilities cannot be empty.");
    }
    for (const cap of metadata.capabilities) {
      if (!Object.values(PluginCapability).includes(cap)) {
        throw new PluginValidationException(`Invalid Plugin Capability: ${cap}`);
      }
    }
  }
}
