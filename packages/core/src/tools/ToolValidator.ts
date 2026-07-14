import { ToolMetadata } from "./ToolMetadata";
import { ToolRequest } from "./ToolRequest";
import { ToolCapability } from "./ToolCapability";
import { ToolValidationException } from "./types";

export class ToolValidator {
  public validateMetadata(metadata: ToolMetadata): void {
    if (!metadata.id || metadata.id.trim() === "") {
      throw new ToolValidationException("Tool ID cannot be empty.");
    }
    if (!metadata.name || metadata.name.trim() === "") {
      throw new ToolValidationException("Tool Name cannot be empty.");
    }
    if (!metadata.version || metadata.version.trim() === "") {
      throw new ToolValidationException("Tool Version cannot be empty.");
    }
    if (!metadata.description || metadata.description.trim() === "") {
      throw new ToolValidationException("Tool Description cannot be empty.");
    }
    if (!metadata.author || metadata.author.trim() === "") {
      throw new ToolValidationException("Tool Author cannot be empty.");
    }
    if (!metadata.capabilities || metadata.capabilities.length === 0) {
      throw new ToolValidationException("Tool capabilities cannot be empty.");
    }
    for (const cap of metadata.capabilities) {
      if (!Object.values(ToolCapability).includes(cap)) {
        throw new ToolValidationException(`Invalid Tool Capability: ${cap}`);
      }
    }
  }

  public validateRequest(request: ToolRequest, expectedToolId: string): void {
    if (!request.toolId || request.toolId.trim() === "") {
      throw new ToolValidationException("Request Tool ID cannot be empty.");
    }
    if (request.toolId !== expectedToolId) {
      throw new ToolValidationException(
        `Mismatched Tool ID. Request specifies "${request.toolId}", but tool ID is "${expectedToolId}".`
      );
    }
    if (!request.correlationId || request.correlationId.trim() === "") {
      throw new ToolValidationException("Request correlation ID cannot be empty.");
    }
    if (request.input === null || request.input === undefined) {
      throw new ToolValidationException("Request input cannot be null or undefined.");
    }
    if (request.metadata === null || request.metadata === undefined) {
      throw new ToolValidationException("Request metadata cannot be null or undefined.");
    }
  }
}
