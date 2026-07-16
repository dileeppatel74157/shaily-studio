import { ILogger } from "../../logger/ILogger";

export interface TransportContext {
  readonly env: string;
  readonly namespace: string;
  readonly logger?: ILogger;
}
