import { LogFormatter } from "./LogFormatter";
import { LogLevel } from "./LogLevel";
import { LogTransport } from "./LogTransport";

export interface LoggerConfig {
  readonly minLevel: LogLevel;
  readonly transports: LogTransport[];
  readonly formatter: LogFormatter;
  readonly timestampFormat?: string;
  readonly enableColors?: boolean;
}
