import * as http from "http";
import * as url from "url";
import { GatewayContext } from "./GatewayContext";
import { GatewayState } from "./GatewayState";
import { RouteDefinition } from "./RouteDefinition";
import { GatewayRequest } from "./GatewayRequest";
import { GatewayResponse } from "./GatewayResponse";
import { GatewaySnapshot } from "./GatewaySnapshot";
import { GatewayRouter } from "./GatewayRouter";
import { GatewayValidator } from "./GatewayValidator";
import { ErrorHandler } from "./ErrorHandler";
import { GatewayMiddleware } from "./GatewayMiddleware";
import { InvalidGatewayStateException, deepFreeze } from "./types";

export class GatewayServer {
  private _state: GatewayState = GatewayState.CREATED;
  private readonly _router = new GatewayRouter();
  private readonly _validator = new GatewayValidator();
  private readonly _errorHandler = new ErrorHandler();
  private _httpServer: http.Server | null = null;

  constructor(
    public readonly context: GatewayContext,
    public readonly host: string,
    public readonly port: number
  ) {
    deepFreeze(this.context);
  }

  public get state(): GatewayState {
    return this._state;
  }

  public async initialize(): Promise<void> {
    if (this._state !== GatewayState.CREATED) {
      throw new InvalidGatewayStateException("initialize", this._state);
    }
    this._state = GatewayState.READY;
  }

  public async start(): Promise<void> {
    if (this._state !== GatewayState.READY) {
      throw new InvalidGatewayStateException("start", this._state);
    }

    this._httpServer = http.createServer((req, res) => {
      // CORS headers
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Correlation-Id");

      if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
      }

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
        const method = (req.method || "GET").toUpperCase();

        const gatewayRequest: GatewayRequest = {
          method,
          path,
          headers: req.headers as Record<string, string>,
          query: query as Record<string, string>,
          params: {},
          body,
          correlationId: (req.headers["x-correlation-id"] as string) || `corr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        };

        try {
          const gatewayResponse = await this.handle(gatewayRequest);
          res.writeHead(gatewayResponse.status, gatewayResponse.headers || {});
          if (gatewayResponse.body !== null && gatewayResponse.body !== undefined) {
            if (gatewayResponse.body && typeof gatewayResponse.body.pipe === "function") {
              gatewayResponse.body.pipe(res);
            } else if (typeof gatewayResponse.body === "object") {
              res.end(JSON.stringify(gatewayResponse.body));
            } else {
              res.end(gatewayResponse.body);
            }
          } else {
            res.end();
          }
        } catch (err: any) {
          const errRes = this._errorHandler.handleError(err, gatewayRequest);
          res.writeHead(errRes.status, errRes.headers || {});
          res.end(JSON.stringify(errRes.body));
        }
      });
    });

    await new Promise<void>((resolve, reject) => {
      this._httpServer!.listen(this.port, this.host, () => {
        resolve();
      });
      this._httpServer!.on("error", (err) => {
        reject(err);
      });
    });

    this._state = GatewayState.RUNNING;
  }

  public async stop(): Promise<void> {
    if (this._state !== GatewayState.RUNNING) {
      throw new InvalidGatewayStateException("stop", this._state);
    }
    
    if (this._httpServer) {
      await new Promise<void>((resolve, reject) => {
        this._httpServer!.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      this._httpServer = null;
    }
    
    this._state = GatewayState.STOPPED;
  }

  public registerRoute(route: RouteDefinition): void {
    this._validator.validateRoute(route);
    this._router.registerRoute(route);
  }

  public unregisterRoute(method: string, path: string): boolean {
    return this._router.unregisterRoute(method, path);
  }

  public registerMiddleware(middleware: GatewayMiddleware): void {
    this._router.registerMiddleware(middleware);
  }

  public async handle(request: GatewayRequest): Promise<GatewayResponse> {
    if (this._state !== GatewayState.RUNNING) {
      return this._errorHandler.handleError(
        new InvalidGatewayStateException("handle", this._state),
        request
      );
    }

    try {
      this._validator.validateRequest(request);
      deepFreeze(request);

      const response = await this._router.handle(request);
      return deepFreeze(response);
    } catch (err: any) {
      return this._errorHandler.handleError(err, request);
    }
  }

  public snapshot(): GatewaySnapshot {
    const routeSnaps = this._router.listRoutes().map((r) => ({
      method: r.method,
      path: r.path,
      metadata: r.metadata,
    }));

    return deepFreeze({
      state: this._state,
      routesCount: routeSnaps.length,
      routes: routeSnaps,
      middlewaresCount: this._router.listMiddlewares().length,
      timestamp: new Date(),
      metadata: this.context.metadata,
    });
  }
}
