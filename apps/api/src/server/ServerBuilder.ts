import { Server } from "./Server";
import { IServer } from "./IServer";
import { RouteDefinition } from "./RouteDefinition";
import { MiddlewareDefinition } from "./MiddlewareDefinition";
import { ServerMetadata } from "./ServerMetadata";
import { ServerContext } from "./ServerContext";
import { ServerValidator } from "./ServerValidator";
import { ServerValidationException } from "./types";
import { ILogger, IConfig } from "@shaily/core";

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class ServerBuilder {
  private _environment = "development";
  private _port = 3000;
  private _host = "127.0.0.1";
  private readonly _middlewares: MiddlewareDefinition[] = [];
  private readonly _routes: RouteDefinition[] = [];
  private _metadata: Record<string, any> = {};
  private _logger?: ILogger;
  private _config?: IConfig;

  public withEnvironment(environment: string): this {
    this._environment = environment;
    return this;
  }

  public withPort(port: number): this {
    this._port = port;
    return this;
  }

  public withHost(host: string): this {
    this._host = host;
    return this;
  }

  public withRoute(route: RouteDefinition): this {
    this._routes.push(route);
    return this;
  }

  public withMiddleware(middleware: MiddlewareDefinition): this {
    this._middlewares.push(middleware);
    return this;
  }

  public withMetadata(metadata: Record<string, any>): this {
    this._metadata = { ...this._metadata, ...metadata };
    return this;
  }

  public withLogger(logger: ILogger): this {
    this._logger = logger;
    return this;
  }

  public withConfig(config: IConfig): this {
    this._config = config;
    return this;
  }

  public build(): IServer {
    const id = this._metadata.id || generateUUID();
    const version = this._metadata.version || "1.0.0";

    const metadata: ServerMetadata = {
      id,
      environment: this._environment,
      version,
      port: this._port,
      host: this._host,
      ...this._metadata,
    };

    const validator = new ServerValidator();
    validator.validateMetadata(metadata);

    if (!this._logger) {
      throw new ServerValidationException("Logger dependency is required.");
    }
    if (!this._config) {
      throw new ServerValidationException("Config dependency is required.");
    }

    const context: ServerContext = {
      logger: this._logger,
      config: this._config,
    };

    const server = new Server(metadata, context);

    for (const middleware of this._middlewares) {
      server.registerMiddleware(middleware);
    }
    for (const route of this._routes) {
      server.registerRoute(route);
    }

    return server;
  }
}
