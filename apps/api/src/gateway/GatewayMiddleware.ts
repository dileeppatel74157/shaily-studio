import { GatewayRequest } from "./GatewayRequest";
import { GatewayResponse } from "./GatewayResponse";

export type NextFunction = (
  request: GatewayRequest
) => Promise<GatewayResponse>;

export interface GatewayMiddleware {
  readonly name: string;
  execute(
    request: GatewayRequest,
    next: NextFunction
  ): Promise<GatewayResponse>;
}
