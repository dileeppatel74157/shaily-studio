import { LogLevel } from "./LogLevel";
import { LogMetadata } from "./LogMetadata";
import { LoggerContext } from "./LoggerContext";

export interface LogEntry {
  readonly id: string;
  readonly timestamp: Date;
  readonly level: LogLevel;
  readonly message: string;
  readonly module: string;
  readonly context: LoggerContext;
  readonly metadata: LogMetadata;
  readonly error?: Error;
}
