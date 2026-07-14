import { ITool } from "./ITool";
import { ToolRequest } from "./ToolRequest";
import { ToolResponse } from "./ToolResponse";
import { ToolSnapshot } from "./ToolSnapshot";
import { ToolValidationException, deepFreeze } from "./types";

export interface ToolRegistrySnapshot {
  readonly toolsCount: number;
  readonly tools: readonly ToolSnapshot[];
}

export class ToolRegistry {
  private readonly _tools = new Map<string, ITool>();

  public register(tool: ITool): void {
    if (this._tools.has(tool.metadata.id)) {
      throw new ToolValidationException(
        `Tool with ID "${tool.metadata.id}" is already registered.`
      );
    }
    this._tools.set(tool.metadata.id, tool);
  }

  public unregister(toolId: string): boolean {
    return this._tools.delete(toolId);
  }

  public get(toolId: string): ITool | undefined {
    return this._tools.get(toolId);
  }

  public has(toolId: string): boolean {
    return this._tools.has(toolId);
  }

  public async execute(
    toolId: string,
    request: ToolRequest
  ): Promise<ToolResponse> {
    const tool = this._tools.get(toolId);
    if (!tool) {
      throw new ToolValidationException(`Tool with ID "${toolId}" is not registered.`);
    }
    return await tool.execute(request);
  }

  public snapshot(): ToolRegistrySnapshot {
    const snaps = Array.from(this._tools.values()).map((t) => t.snapshot());
    return deepFreeze({
      toolsCount: snaps.length,
      tools: snaps,
    });
  }
}
