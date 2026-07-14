import { RouteDefinition } from "./RouteDefinition";
import { HttpMethod } from "./HttpMethod";
import { ServerValidationException } from "./types";

export class RouteRegistry {
  private readonly _routes: RouteDefinition[] = [];

  public register(route: RouteDefinition): void {
    // Duplicate detection
    const isDuplicate = this._routes.some(
      (r) => r.path === route.path && r.method === route.method
    );
    if (isDuplicate) {
      throw new ServerValidationException(
        `Duplicate route registered: ${route.method} ${route.path}`
      );
    }
    this._routes.push(route);
  }

  public lookup(
    method: HttpMethod,
    path: string
  ): { route: RouteDefinition; params: Record<string, string> } | null {
    const requestSegments = path.split("/").filter((s) => s.length > 0);

    for (const route of this._routes) {
      if (route.method !== method) {
        continue;
      }

      const routeSegments = route.path.split("/").filter((s) => s.length > 0);
      if (routeSegments.length !== requestSegments.length) {
        continue;
      }

      let matches = true;
      const params: Record<string, string> = {};

      for (let i = 0; i < routeSegments.length; i++) {
        const routeSeg = routeSegments[i];
        const reqSeg = requestSegments[i];

        if (routeSeg.startsWith(":")) {
          const paramName = routeSeg.slice(1);
          params[paramName] = decodeURIComponent(reqSeg);
        } else if (routeSeg.toLowerCase() !== reqSeg.toLowerCase()) {
          matches = false;
          break;
        }
      }

      if (matches) {
        return { route, params };
      }
    }

    return null;
  }

  public snapshot(): readonly RouteDefinition[] {
    return Object.freeze(
      this._routes.map((r) =>
        Object.freeze({
          id: r.id,
          path: r.path,
          method: r.method,
          handler: r.handler,
          metadata: Object.freeze({ ...r.metadata }),
        })
      )
    );
  }
}
