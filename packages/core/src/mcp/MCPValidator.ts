import { MCPRequest } from "./MCPRequest";
import { MCPTool } from "./MCPTool";
import { MCPPrompt } from "./MCPPrompt";
import { MCPResource } from "./MCPResource";
import { MCPValidationException } from "./types";
import { MCPTransport } from "./MCPTransport";

export class MCPValidator {
  public validateTransport(transport: MCPTransport): void {
    if (!transport) {
      throw new MCPValidationException("Transport is required.");
    }
  }

  public validateRequest(request: MCPRequest): void {
    if (request === null || request === undefined) {
      throw new MCPValidationException("Request cannot be null or undefined.");
    }
    if (!request.method || request.method.trim() === "") {
      throw new MCPValidationException("Request method cannot be empty.");
    }
    if (request.id === undefined || request.id === null) {
      throw new MCPValidationException("Request ID is required.");
    }
  }

  public validateTool(tool: MCPTool): void {
    if (!tool.name || tool.name.trim() === "") {
      throw new MCPValidationException("Tool name cannot be empty.");
    }
    if (!tool.description || tool.description.trim() === "") {
      throw new MCPValidationException("Tool description cannot be empty.");
    }
    if (!tool.inputSchema) {
      throw new MCPValidationException("Tool inputSchema is required.");
    }
  }

  public validatePrompt(prompt: MCPPrompt): void {
    if (!prompt.name || prompt.name.trim() === "") {
      throw new MCPValidationException("Prompt name cannot be empty.");
    }
    if (!prompt.description || prompt.description.trim() === "") {
      throw new MCPValidationException("Prompt description cannot be empty.");
    }
  }

  public validateResource(resource: MCPResource): void {
    if (!resource.uri || resource.uri.trim() === "") {
      throw new MCPValidationException("Resource URI cannot be empty.");
    }
    if (!resource.name || resource.name.trim() === "") {
      throw new MCPValidationException("Resource name cannot be empty.");
    }
    if (!resource.mimeType || resource.mimeType.trim() === "") {
      throw new MCPValidationException("Resource mimeType cannot be empty.");
    }
  }
}
