import { GatewayRequest } from "./GatewayRequest";
import { GatewayResponse } from "./GatewayResponse";
import { deepFreeze } from "./types";

export class ErrorHandler {
  public handleError(error: any, request: GatewayRequest): GatewayResponse {
    const correlationId = request?.correlationId || "unknown";

    let code = "ROUTE_EXECUTION_FAILED";
    let status = 500;

    if (error.name === "GatewayValidationException") {
      code = "VALIDATION_FAILED";
      status = 400;
    } else if (error.name === "RouteNotFoundException") {
      code = "ROUTE_NOT_FOUND";
      status = 404;
    } else if (error.name === "InvalidGatewayStateException") {
      code = "INVALID_STATE";
      status = 409;
    } else if (error.code) {
      code = error.code;
    }

    const body = {
      success: false,
      code,
      message: error.message || "An unexpected error occurred.",
      correlationId,
    };

    return deepFreeze({
      status,
      headers: { "Content-Type": "application/json" },
      body,
    });
  }
}
