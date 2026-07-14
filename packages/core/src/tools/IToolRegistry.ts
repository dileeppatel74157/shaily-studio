import { ITool } from "./ITool";
import { ToolRequest } from "./ToolRequest";
import { ToolResponse } from "./ToolResponse";
import { ToolRegistrySnapshot } from "./ToolRegistry";

export interface IToolRegistry {
  register(tool: ITool): void;
  unregister(toolId: string): boolean;
  get(toolId: string): ITool | undefined;
  has(toolId: string): boolean;
  execute(toolId: string, request: ToolRequest): Promise<ToolResponse>;
  snapshot(): ToolRegistrySnapshot;
}
