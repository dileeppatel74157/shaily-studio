import { LogMetadata } from "./LogMetadata";
import { LoggerContext } from "./LoggerContext";

export interface ILogger {
  trace(message: string, metadata?: LogMetadata | Record<string, unknown>, error?: Error): void;
  debug(message: string, metadata?: LogMetadata | Record<string, unknown>, error?: Error): void;
  info(message: string, metadata?: LogMetadata | Record<string, unknown>, error?: Error): void;
  warn(message: string, metadata?: LogMetadata | Record<string, unknown>, error?: Error): void;
  error(message: string, metadata?: LogMetadata | Record<string, unknown>, error?: Error): void;
  fatal(message: string, metadata?: LogMetadata | Record<string, unknown>, error?: Error): void;

  child(contextExtension: Partial<LoggerContext>): ILogger;
  flush(): Promise<void>;
}
