import { GatewayRequest } from "./GatewayRequest";
import { GatewayResponse } from "./GatewayResponse";

export type RouteHandler = (
  request: GatewayRequest
) => Promise<GatewayResponse> | GatewayResponse;

export interface RouteDefinition {
  readonly method: string;
  readonly path: string;
  readonly handler: RouteHandler;
  readonly metadata: Readonly<Record<string, any>>;
}
