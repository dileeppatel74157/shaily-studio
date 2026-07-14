import { RouteDefinition } from "./RouteDefinition";
import { GatewayRequest } from "./GatewayRequest";
import { GatewayValidationException } from "./types";

export class GatewayValidator {
  private readonly _supportedMethods = [
    "GET",
    "POST",
    "PUT",
    "DELETE",
    "PATCH",
  ];

  public validateRoute(route: RouteDefinition): void {
    if (!route) {
      throw new GatewayValidationException(
        "Route definition cannot be null or undefined."
      );
    }
    if (!route.method || route.method.trim() === "") {
      throw new GatewayValidationException("Route method cannot be empty.");
    }
    const upperMethod = route.method.toUpperCase();
    if (!this._supportedMethods.includes(upperMethod)) {
      throw new GatewayValidationException(
        `Unsupported route method: "${route.method}".`
      );
    }
    if (!route.path || route.path.trim() === "") {
      throw new GatewayValidationException("Route path cannot be empty.");
    }
    if (!route.path.startsWith("/")) {
      throw new GatewayValidationException(
        `Route path must start with "/": "${route.path}".`
      );
    }
    if (!route.handler) {
      throw new GatewayValidationException("Route handler is required.");
    }
  }

  public validateRequest(request: GatewayRequest): void {
    if (!request) {
      throw new GatewayValidationException(
        "Request cannot be null or undefined."
      );
    }
    if (!request.method || request.method.trim() === "") {
      throw new GatewayValidationException("Request method cannot be empty.");
    }
    if (!request.path || request.path.trim() === "") {
      throw new GatewayValidationException("Request path cannot be empty.");
    }
    if (!request.correlationId || request.correlationId.trim() === "") {
      throw new GatewayValidationException("Request correlation ID is required.");
    }
  }
}
