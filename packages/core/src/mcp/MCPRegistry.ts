import { MCPTool } from "./MCPTool";
import { MCPPrompt } from "./MCPPrompt";
import { MCPResource } from "./MCPResource";
import { MCPValidator } from "./MCPValidator";
import { MCPValidationException, deepFreeze } from "./types";

export interface MCPRegistrySnapshot {
  readonly toolsCount: number;
  readonly promptsCount: number;
  readonly resourcesCount: number;
}

export class MCPRegistry {
  private readonly _tools = new Map<string, MCPTool>();
  private readonly _prompts = new Map<string, MCPPrompt>();
  private readonly _resources = new Map<string, MCPResource>();
  private readonly _validator = new MCPValidator();

  public registerTool(tool: MCPTool): void {
    this._validator.validateTool(tool);
    if (this._tools.has(tool.name)) {
      throw new MCPValidationException(
        `Tool with name "${tool.name}" is already registered.`
      );
    }
    this._tools.set(tool.name, deepFreeze(tool));
  }

  public registerPrompt(prompt: MCPPrompt): void {
    this._validator.validatePrompt(prompt);
    if (this._prompts.has(prompt.name)) {
      throw new MCPValidationException(
        `Prompt with name "${prompt.name}" is already registered.`
      );
    }
    this._prompts.set(prompt.name, deepFreeze(prompt));
  }

  public registerResource(resource: MCPResource): void {
    this._validator.validateResource(resource);
    if (this._resources.has(resource.uri)) {
      throw new MCPValidationException(
        `Resource with URI "${resource.uri}" is already registered.`
      );
    }
    this._resources.set(resource.uri, deepFreeze(resource));
  }

  public getTool(name: string): MCPTool | undefined {
    return this._tools.get(name);
  }

  public getPrompt(name: string): MCPPrompt | undefined {
    return this._prompts.get(name);
  }

  public getResource(uri: string): MCPResource | undefined {
    return this._resources.get(uri);
  }

  public listTools(): readonly MCPTool[] {
    return deepFreeze(Array.from(this._tools.values()));
  }

  public listPrompts(): readonly MCPPrompt[] {
    return deepFreeze(Array.from(this._prompts.values()));
  }

  public listResources(): readonly MCPResource[] {
    return deepFreeze(Array.from(this._resources.values()));
  }

  public snapshot(): MCPRegistrySnapshot {
    return deepFreeze({
      toolsCount: this._tools.size,
      promptsCount: this._prompts.size,
      resourcesCount: this._resources.size,
    });
  }
}
