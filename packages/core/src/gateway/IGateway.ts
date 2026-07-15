import { GatewayState } from "./GatewayState";
import { GatewayContext } from "./GatewayContext";
import { RouteDefinition } from "./RouteDefinition";
import { GatewayRequest } from "./GatewayRequest";
import { GatewayResponse } from "./GatewayResponse";
import { GatewaySnapshot } from "./GatewaySnapshot";

export interface IGateway {
  readonly state: GatewayState;
  readonly context: GatewayContext;

  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;

  registerRoute(route: RouteDefinition): void;
  unregisterRoute(path: string): boolean;

  handle(request: GatewayRequest): Promise<GatewayResponse>;

  snapshot(): GatewaySnapshot;
}
