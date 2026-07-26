import { Clock } from "./Clock";
import { LogFormatter } from "../interfaces/LogFormatter";
import { LogLevel } from "../types/LogLevel";
import { TransportPipeline } from "../engine/TransportPipeline";

export interface LoggerConfig {
  readonly minLevel: LogLevel;
  readonly pipeline: TransportPipeline;
  readonly formatter: LogFormatter;
  readonly clock: Clock;
  readonly timestampFormat?: string;
  readonly enableColors?: boolean;
}
