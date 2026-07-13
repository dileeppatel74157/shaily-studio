import { ILogger } from "./ILogger";
import { LogEntry } from "./LogEntry";
import { LogLevel } from "./LogLevel";
import { LoggerConfig } from "./LoggerConfig";
import { LoggerContext } from "./LoggerContext";

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class Logger implements ILogger {
  private readonly _config: LoggerConfig;
  private readonly _context: LoggerContext;

  constructor(config: LoggerConfig, context: LoggerContext) {
    this._config = config;
    this._context = context;
  }

  private log(level: LogLevel, message: string, metadata?: Record<string, unknown>, error?: Error): void {
    if (level < this._config.minLevel) {
      return;
    }

    const entry: LogEntry = {
      id: generateUUID(),
      timestamp: new Date(),
      level,
      message,
      module: this._context.moduleName,
      context: this._context,
      metadata,
      error,
    };

    for (const transport of this._config.transports) {
      try {
        transport.send(entry);
      } catch (err) {
        // Fallback log stream in case of transport crash
        // eslint-disable-next-line no-console
        console.error(`Logger transport send failed: ${err}`);
      }
    }
  }

  public trace(message: string, metadata?: Record<string, unknown>, error?: Error): void {
    this.log(LogLevel.TRACE, message, metadata, error);
  }

  public debug(message: string, metadata?: Record<string, unknown>, error?: Error): void {
    this.log(LogLevel.DEBUG, message, metadata, error);
  }

  public info(message: string, metadata?: Record<string, unknown>, error?: Error): void {
    this.log(LogLevel.INFO, message, metadata, error);
  }

  public warn(message: string, metadata?: Record<string, unknown>, error?: Error): void {
    this.log(LogLevel.WARN, message, metadata, error);
  }

  public error(message: string, metadata?: Record<string, unknown>, error?: Error): void {
    this.log(LogLevel.ERROR, message, metadata, error);
  }

  public fatal(message: string, metadata?: Record<string, unknown>, error?: Error): void {
    this.log(LogLevel.FATAL, message, metadata, error);
  }

  public child(contextExtension: Partial<LoggerContext>): ILogger {
    const newContext: LoggerContext = {
      ...this._context,
      ...contextExtension,
    };
    return new Logger(this._config, newContext);
  }

  public async flush(): Promise<void> {
    await Promise.resolve();
  }
}
