import { IMCPServer } from "./IMCPServer";
import { MCPContext } from "./MCPContext";
import { MCPTransport } from "./MCPTransport";
import { MCPTool } from "./MCPTool";
import { MCPPrompt } from "./MCPPrompt";
import { MCPResource } from "./MCPResource";
import { MCPRequest } from "./MCPRequest";
import { MCPResponse } from "./MCPResponse";
import { MCPSnapshot } from "./MCPSnapshot";
import { MCPRegistry } from "./MCPRegistry";
import { MCPValidator } from "./MCPValidator";
import { MCPServerState, InvalidMCPStateException, deepFreeze } from "./types";

export class MCPServer implements IMCPServer {
  private _state: MCPServerState = MCPServerState.CREATED;
  private readonly _registry = new MCPRegistry();
  private readonly _validator = new MCPValidator();

  constructor(
    public readonly context: MCPContext,
    public readonly transport: MCPTransport
  ) {
    this._validator.validateTransport(transport);
    deepFreeze(this.context);
  }

  public get state(): MCPServerState {
    return this._state;
  }

  public async initialize(): Promise<void> {
    if (this._state !== MCPServerState.CREATED) {
      throw new InvalidMCPStateException("initialize", this._state);
    }
    try {
      this._state = MCPServerState.READY;
    } catch (err) {
      this._state = MCPServerState.FAILED;
      throw err;
    }
  }

  public async start(): Promise<void> {
    if (this._state !== MCPServerState.READY) {
      throw new InvalidMCPStateException("start", this._state);
    }
    try {
      this._state = MCPServerState.RUNNING;
    } catch (err) {
      this._state = MCPServerState.FAILED;
      throw err;
    }
  }

  public async stop(): Promise<void> {
    if (this._state !== MCPServerState.RUNNING) {
      throw new InvalidMCPStateException("stop", this._state);
    }
    try {
      await this.transport.close();
      this._state = MCPServerState.STOPPED;
    } catch (err) {
      this._state = MCPServerState.FAILED;
      throw err;
    }
  }

  public registerTool(tool: MCPTool): void {
    this._registry.registerTool(tool);
  }

  public registerPrompt(prompt: MCPPrompt): void {
    this._registry.registerPrompt(prompt);
  }

  public registerResource(resource: MCPResource): void {
    this._registry.registerResource(resource);
  }

  public async handle(request: MCPRequest): Promise<MCPResponse> {
    if (this._state !== MCPServerState.RUNNING) {
      throw new InvalidMCPStateException("handle", this._state);
    }

    this._validator.validateRequest(request);
    deepFreeze(request);

    let response: MCPResponse;

    try {
      switch (request.method) {
        case "tools/list":
          response = {
            result: { tools: this._registry.listTools() },
            id: request.id,
          };
          break;

        case "tools/call": {
          const name = request.params?.name;
          const tool = this._registry.getTool(name);
          if (!tool) {
            response = {
              error: { code: -32601, message: `Tool not found: "${name}"` },
              id: request.id,
            };
          } else {
            response = {
              result: {
                content: [
                  { type: "text", text: `Mock tool execution of ${name}` },
                ],
              },
              id: request.id,
            };
          }
          break;
        }

        case "prompts/list":
          response = {
            result: { prompts: this._registry.listPrompts() },
            id: request.id,
          };
          break;

        case "prompts/get": {
          const name = request.params?.name;
          const prompt = this._registry.getPrompt(name);
          if (!prompt) {
            response = {
              error: { code: -32601, message: `Prompt not found: "${name}"` },
              id: request.id,
            };
          } else {
            response = {
              result: { prompt },
              id: request.id,
            };
          }
          break;
        }

        case "resources/list":
          response = {
            result: { resources: this._registry.listResources() },
            id: request.id,
          };
          break;

        case "resources/read": {
          const uri = request.params?.uri;
          const resource = this._registry.getResource(uri);
          if (!resource) {
            response = {
              error: {
                code: -32601,
                message: `Resource not found: "${uri}"`,
              },
              id: request.id,
            };
          } else {
            response = {
              result: {
                contents: [
                  { uri: resource.uri, text: "Mock resource content" },
                ],
              },
              id: request.id,
            };
          }
          break;
        }

        default:
          response = {
            error: {
              code: -32601,
              message: `Method not found: "${request.method}"`,
            },
            id: request.id,
          };
          break;
      }
    } catch (err: any) {
      response = {
        error: { code: -32603, message: err.message || "Internal error" },
        id: request.id,
      };
    }

    return deepFreeze(response);
  }

  public snapshot(): MCPSnapshot {
    const regSnap = this._registry.snapshot();
    return deepFreeze({
      state: this._state,
      toolsCount: regSnap.toolsCount,
      promptsCount: regSnap.promptsCount,
      resourcesCount: regSnap.resourcesCount,
      timestamp: new Date(),
      metadata: this.context.metadata,
    });
  }
}
