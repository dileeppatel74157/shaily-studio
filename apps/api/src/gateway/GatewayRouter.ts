import { RouteDefinition } from "./RouteDefinition";
import { GatewayRequest } from "./GatewayRequest";
import { GatewayResponse } from "./GatewayResponse";
import { GatewayMiddleware } from "./GatewayMiddleware";
import { GatewayValidationException } from "./types";

export class RouteNotFoundException extends Error {
  constructor(path: string) {
    super(`Route not found for path: "${path}"`);
    this.name = "RouteNotFoundException";
  }
}

export class GatewayRouter {
  private readonly _routes: RouteDefinition[] = [];
  private readonly _middlewares: GatewayMiddleware[] = [];

  public registerRoute(route: RouteDefinition): void {
    const duplicate = this._routes.find(
      (r) =>
        r.method.toUpperCase() === route.method.toUpperCase() &&
        r.path === route.path
    );
    if (duplicate) {
      throw new GatewayValidationException(
        `Route with method "${route.method}" and path "${route.path}" is already registered.`
      );
    }
    this._routes.push(route);
  }

  public unregisterRoute(method: string, path: string): boolean {
    const idx = this._routes.findIndex(
      (r) => r.method.toUpperCase() === method.toUpperCase() && r.path === path
    );
    if (idx !== -1) {
      this._routes.splice(idx, 1);
      return true;
    }
    return false;
  }

  public registerMiddleware(middleware: GatewayMiddleware): void {
    this._middlewares.push(middleware);
  }

  public listRoutes(): readonly RouteDefinition[] {
    return Object.freeze([...this._routes]);
  }

  public listMiddlewares(): readonly GatewayMiddleware[] {
    return Object.freeze([...this._middlewares]);
  }

  public async handle(request: GatewayRequest): Promise<GatewayResponse> {
    const match = this.matchRoute(request.method, request.path);
    if (!match) {
      throw new RouteNotFoundException(request.path);
    }

    const matchedRequest: GatewayRequest = {
      ...request,
      params: { ...request.params, ...match.params },
    };

    // Onion-model middleware executor
    const execute = async (
      index: number,
      req: GatewayRequest
    ): Promise<GatewayResponse> => {
      if (index < this._middlewares.length) {
        const mw = this._middlewares[index];
        return await mw.execute(req, (nextReq) => execute(index + 1, nextReq));
      }
      return await match.route.handler(req);
    };

    return await execute(0, matchedRequest);
  }

  private matchRoute(
    method: string,
    path: string
  ): { route: RouteDefinition; params: Record<string, string> } | null {
    const reqMethod = method.toUpperCase();
    const reqParts = path.split("/").filter((p: string) => p !== "");

    for (const route of this._routes) {
      if (route.method.toUpperCase() !== reqMethod) {
        continue;
      }

      const routeParts = route.path.split("/").filter((p: string) => p !== "");
      if (routeParts.length !== reqParts.length) {
        continue;
      }

      let isMatch = true;
      const params: Record<string, string> = {};

      for (let i = 0; i < routeParts.length; i++) {
        const rp = routeParts[i];
        const reqP = reqParts[i];

        if (rp.startsWith(":")) {
          const paramName = rp.slice(1);
          params[paramName] = reqP;
        } else if (rp.toLowerCase() !== reqP.toLowerCase()) {
          isMatch = false;
          break;
        }
      }

      if (isMatch) {
        return { route, params };
      }
    }

    return null;
  }
}
