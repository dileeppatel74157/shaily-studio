import { IMCPServer } from "./IMCPServer";
import { MCPServer } from "./MCPServer";
import { MCPContext } from "./MCPContext";
import { MCPTransport } from "./MCPTransport";
import { MCPValidationException } from "./types";

export class MCPBuilder {
  private _context?: MCPContext;
  private _transport?: MCPTransport;
  private _metadata: Record<string, any> = {};

  public withContext(context: MCPContext): this {
    this._context = context;
    return this;
  }

  public withTransport(transport: MCPTransport): this {
    this._transport = transport;
    return this;
  }

  public withMetadata(metadata: Record<string, any>): this {
    this._metadata = { ...this._metadata, ...metadata };
    return this;
  }

  public build(): IMCPServer {
    if (!this._context) {
      throw new MCPValidationException("Context is required to build MCPServer.");
    }
    if (!this._transport) {
      throw new MCPValidationException(
        "Transport is required to build MCPServer."
      );
    }

    const finalContext: MCPContext = {
      ...this._context,
      metadata: { ...this._context.metadata, ...this._metadata },
    };

    return new MCPServer(finalContext, this._transport);
  }
}
