import { ToolMetadata } from "./ToolMetadata";
import { ToolContext } from "./ToolContext";
import { ToolState } from "./ToolState";
import { ToolRequest } from "./ToolRequest";
import { ToolResponse } from "./ToolResponse";
import { ToolSnapshot } from "./ToolSnapshot";

export interface ITool {
  readonly metadata: ToolMetadata;
  readonly context: ToolContext;
  readonly state: ToolState;

  initialize(): Promise<void>;
  execute(request: ToolRequest): Promise<ToolResponse>;
  shutdown(): Promise<void>;
  snapshot(): ToolSnapshot;
}
