import { ServerContext } from "./ServerContext";
import { ServerState } from "./ServerState";
import { RouteDefinition } from "./RouteDefinition";
import { MiddlewareDefinition } from "./MiddlewareDefinition";
import { ServerSnapshot } from "./ServerSnapshot";

export interface IServer {
  readonly context: ServerContext;
  readonly state: ServerState;
  readonly id: string;
  readonly version: string;
  readonly environment: string;
  readonly port: number;
  readonly host: string;

  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  registerRoute(route: RouteDefinition): void;
  registerMiddleware(middleware: MiddlewareDefinition): void;
  snapshot(): ServerSnapshot;
}
