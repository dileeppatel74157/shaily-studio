import { LogLevel } from "./LogLevel";
import { LoggerContext } from "./LoggerContext";

export interface LogEntry {
  readonly id: string;
  readonly timestamp: Date;
  readonly level: LogLevel;
  readonly message: string;
  readonly module: string;
  readonly context: LoggerContext;
  readonly metadata?: Record<string, unknown>;
  readonly error?: Error;
}
