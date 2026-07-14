import { MCPTool } from "./MCPTool";
import { MCPPrompt } from "./MCPPrompt";
import { MCPResource } from "./MCPResource";
import { MCPRequest } from "./MCPRequest";
import { MCPResponse } from "./MCPResponse";
import { MCPSnapshot } from "./MCPSnapshot";
import { MCPServerState } from "./types";
import { MCPContext } from "./MCPContext";

export interface IMCPServer {
  readonly state: MCPServerState;
  readonly context: MCPContext;

  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;

  registerTool(tool: MCPTool): void;
  registerPrompt(prompt: MCPPrompt): void;
  registerResource(resource: MCPResource): void;

  handle(request: MCPRequest): Promise<MCPResponse>;
  snapshot(): MCPSnapshot;
}
