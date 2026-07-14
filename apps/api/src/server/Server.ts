import * as http from "http";
import * as url from "url";
import { IServer } from "./IServer";
import { ServerState } from "./ServerState";
import { ServerMetadata } from "./ServerMetadata";
import { ServerContext } from "./ServerContext";
import { ServerSnapshot } from "./ServerSnapshot";
import { RouteDefinition } from "./RouteDefinition";
import { MiddlewareDefinition } from "./MiddlewareDefinition";
import { RouteRegistry } from "./RouteRegistry";
import { MiddlewarePipeline } from "./MiddlewarePipeline";
import { HttpRequest } from "./HttpRequest";
import { HttpResponse } from "./HttpResponse";
import { HttpMethod } from "./HttpMethod";
import { InvalidServerStateException } from "./types";
import { ServerValidator } from "./ServerValidator";

export class Server implements IServer {
  private _state: ServerState = ServerState.CREATED;
  private _startTime: Date | null = null;
  private _httpServer: http.Server | null = null;

  private readonly _routeRegistry = new RouteRegistry();
  private readonly _middlewarePipeline = new MiddlewarePipeline();
  private readonly _validator = new ServerValidator();

  constructor(
    private readonly _metadata: ServerMetadata,
    public readonly context: ServerContext
  ) {
    Object.freeze(this.context);
  }

  public get id(): string {
    return this._metadata.id;
  }

  public get version(): string {
    return this._metadata.version;
  }

  public get environment(): string {
    return this._metadata.environment;
  }

  public get port(): number {
    return this._metadata.port;
  }

  public get host(): string {
    return this._metadata.host;
  }

  public get state(): ServerState {
    return this._state;
  }

  public async initialize(): Promise<void> {
    if (this._state !== ServerState.CREATED) {
      throw new InvalidServerStateException("initialize", this._state);
    }

    this._state = ServerState.INITIALIZING;
    this.context.logger.info(`Initializing REST API Server [${this.environment}] on ${this.host}:${this.port}...`);

    try {
      this._state = ServerState.READY;
      this.context.logger.info(`REST API Server READY.`);
    } catch (err: any) {
      this._state = ServerState.FAILED;
      this.context.logger.error(`REST API Server initialization failed: ${err.message}`, {}, err);
      throw err;
    }
  }

  public async start(): Promise<void> {
    if (this._state !== ServerState.READY) {
      throw new InvalidServerStateException("start", this._state);
    }

    this.context.logger.info(`Starting REST API Server...`);
    try {
      this._httpServer = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      await new Promise<void>((resolve, reject) => {
        this._httpServer!.listen(this.port, this.host, () => {
          resolve();
        });
        this._httpServer!.on("error", (err) => {
          reject(err);
        });
      });

      this._startTime = new Date();
      this._state = ServerState.RUNNING;
      this.context.logger.info(`REST API Server is RUNNING at http://${this.host}:${this.port}`);
    } catch (err: any) {
      this._state = ServerState.FAILED;
      this.context.logger.error(`REST API Server startup failed: ${err.message}`, {}, err);
      throw err;
    }
  }

  public async stop(): Promise<void> {
    if (this._state !== ServerState.RUNNING) {
      throw new InvalidServerStateException("stop", this._state);
    }

    this._state = ServerState.STOPPING;
    this.context.logger.info(`Stopping REST API Server...`);

    try {
      if (this._httpServer) {
        await new Promise<void>((resolve, reject) => {
          this._httpServer!.close((err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
        this._httpServer = null;
      }

      this._startTime = null;
      this._state = ServerState.STOPPED;
      this.context.logger.info(`REST API Server STOPPED.`);
    } catch (err: any) {
      this._state = ServerState.FAILED;
      this.context.logger.error(`REST API Server shutdown failed: ${err.message}`, {}, err);
      throw err;
    }
  }

  public registerRoute(route: RouteDefinition): void {
    if (this._state !== ServerState.CREATED && this._state !== ServerState.READY) {
      throw new InvalidServerStateException("registerRoute", this._state);
    }
    this._validator.validateRoute(route);
    this._routeRegistry.register(route);
  }

  public registerMiddleware(middleware: MiddlewareDefinition): void {
    if (this._state !== ServerState.CREATED && this._state !== ServerState.READY) {
      throw new InvalidServerStateException("registerMiddleware", this._state);
    }
    this._validator.validateMiddleware(middleware);
    this._middlewarePipeline.register(middleware);
  }

  public snapshot(): ServerSnapshot {
    const uptime = this._startTime
      ? Math.floor((Date.now() - this._startTime.getTime()) / 1000)
      : 0;

    return Object.freeze({
      id: this.id,
      environment: this.environment,
      version: this.version,
      port: this.port,
      host: this.host,
      state: this._state,
      startTime: this._startTime ? new Date(this._startTime.getTime()) : null,
      uptime,
      registeredRoutesCount: this._routeRegistry.snapshot().length,
      registeredMiddlewaresCount: this._middlewarePipeline.snapshot().length,
      metadata: Object.freeze({ ...this._metadata }),
    });
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => {
      chunks.push(chunk);
    });

    req.on("end", async () => {
      const bodyBuffer = Buffer.concat(chunks);
      let body: any = null;
      const contentType = req.headers["content-type"] || "";

      if (bodyBuffer.length > 0) {
        if (contentType.includes("application/json")) {
          try {
            body = JSON.parse(bodyBuffer.toString("utf8"));
          } catch (err) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid JSON body" }));
            return;
          }
        } else {
          body = bodyBuffer.toString("utf8");
        }
      }

      const parsedUrl = url.parse(req.url || "", true);
      const path = parsedUrl.pathname || "/";
      const query = parsedUrl.query;
      const method = (req.method || "GET").toUpperCase() as HttpMethod;

      const routeMatch = this._routeRegistry.lookup(method, path);

      const httpRequest = new HttpRequest(
        req.headers,
        routeMatch ? routeMatch.params : {},
        query,
        body,
        method,
        path,
        this.context
      );

      try {
        const response = await this._middlewarePipeline.execute(httpRequest, async (currentReq) => {
          if (!routeMatch) {
            return HttpResponse.create()
              .withStatus(404)
              .json({ error: `Route not found: ${currentReq.method} ${currentReq.path}` });
          }
          return await routeMatch.route.handler(currentReq);
        });

        this.sendResponse(res, response);
      } catch (err: any) {
        this.context.logger.error(`Error handling request ${method} ${path}: ${err.message}`, {}, err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal Server Error" }));
      }
    });

    req.on("error", (err) => {
      this.context.logger.error(`Socket error on request: ${err.message}`, {}, err);
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Bad Request" }));
    });
  }

  private sendResponse(res: http.ServerResponse, response: HttpResponse): void {
    const headers = { ...response.headers };
    let bodyToSend: any = response.body;

    if (bodyToSend !== null && bodyToSend !== undefined) {
      if (typeof bodyToSend === "object") {
        bodyToSend = JSON.stringify(bodyToSend);
        if (!headers["content-type"]) {
          headers["content-type"] = "application/json";
        }
      } else if (typeof bodyToSend !== "string") {
        bodyToSend = String(bodyToSend);
      }
    } else {
      bodyToSend = "";
    }

    res.writeHead(response.status, headers);
    res.end(bodyToSend);
  }
}
