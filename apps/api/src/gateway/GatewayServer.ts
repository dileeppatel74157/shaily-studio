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
    this._state = GatewayState.RUNNING;
  }

  public async stop(): Promise<void> {
    if (this._state !== GatewayState.RUNNING) {
      throw new InvalidGatewayStateException("stop", this._state);
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
      // Must wrap in error handler to return structured error even if state is not RUNNING
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
