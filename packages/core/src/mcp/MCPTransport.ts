import { MCPRequest } from "./MCPRequest";
import { MCPResponse } from "./MCPResponse";
import { MCPTransportType } from "./MCPTransportType";

export interface MCPTransport {
  readonly type: MCPTransportType;

  send(response: MCPResponse): Promise<void>;
  receive(): Promise<MCPRequest>;
  close(): Promise<void>;
}
