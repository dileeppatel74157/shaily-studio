import { Clock } from "./Clock";
import { LogFormatter } from "./LogFormatter";
import { LogLevel } from "./LogLevel";
import { TransportPipeline } from "./TransportPipeline";

export interface LoggerConfig {
  readonly minLevel: LogLevel;
  readonly pipeline: TransportPipeline;
  readonly formatter: LogFormatter;
  readonly clock: Clock;
  readonly timestampFormat?: string;
  readonly enableColors?: boolean;
}
