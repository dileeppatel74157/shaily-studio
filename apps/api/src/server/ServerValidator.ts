import { ServerMetadata } from "./ServerMetadata";
import { RouteDefinition } from "./RouteDefinition";
import { MiddlewareDefinition } from "./MiddlewareDefinition";
import { HttpMethod } from "./HttpMethod";
import { ServerValidationException } from "./types";

export class ServerValidator {
  public validateMetadata(metadata: ServerMetadata): void {
    if (!metadata.id || metadata.id.trim() === "") {
      throw new ServerValidationException("Server ID cannot be empty.");
    }
    if (!metadata.version || metadata.version.trim() === "") {
      throw new ServerValidationException("Server version cannot be empty.");
    }
    if (!metadata.environment || metadata.environment.trim() === "") {
      throw new ServerValidationException("Server environment cannot be empty.");
    }
    if (metadata.port <= 0 || metadata.port > 65535) {
      throw new ServerValidationException("Server port must be between 1 and 65535.");
    }
    if (!metadata.host || metadata.host.trim() === "") {
      throw new ServerValidationException("Server host cannot be empty.");
    }
  }

  public validateRoute(route: RouteDefinition): void {
    if (!route.id || route.id.trim() === "") {
      throw new ServerValidationException("Route ID cannot be empty.");
    }
    if (!route.path || route.path.trim() === "") {
      throw new ServerValidationException("Route path cannot be empty.");
    }
    if (!route.path.startsWith("/")) {
      throw new ServerValidationException("Route path must start with '/'.");
    }
    if (!Object.values(HttpMethod).includes(route.method)) {
      throw new ServerValidationException(`Invalid HTTP method: ${route.method}`);
    }
    if (!route.handler) {
      throw new ServerValidationException("Route handler must be defined.");
    }
  }

  public validateMiddleware(middleware: MiddlewareDefinition): void {
    if (!middleware.id || middleware.id.trim() === "") {
      throw new ServerValidationException("Middleware ID cannot be empty.");
    }
    if (!middleware.handler) {
      throw new ServerValidationException("Middleware handler must be defined.");
    }
  }
}
