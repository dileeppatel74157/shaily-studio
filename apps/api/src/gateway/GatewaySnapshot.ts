import { GatewayState } from "./GatewayState";

export interface GatewayRouteSnapshot {
  readonly method: string;
  readonly path: string;
  readonly metadata: Readonly<Record<string, any>>;
}

export interface GatewaySnapshot {
  readonly state: GatewayState;
  readonly routesCount: number;
  readonly routes: readonly GatewayRouteSnapshot[];
  readonly middlewaresCount: number;
  readonly timestamp: Date;
  readonly metadata: Readonly<Record<string, any>>;
}
