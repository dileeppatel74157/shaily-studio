import { ILogger } from "./ILogger";
import { LogEntry } from "./LogEntry";
import { LogEntryFactory } from "./LogEntryFactory";
import { LogLevel } from "./LogLevel";
import { LogMetadata } from "./LogMetadata";
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
  private readonly _factory: LogEntryFactory;

  constructor(config: LoggerConfig, context: LoggerContext) {
    this._config = config;
    this._factory = new LogEntryFactory(config.clock);

    const correlationId = context.correlationId || generateUUID();
    this._context = {
      ...context,
      correlationId,
    };
  }

  // Internal Logger Hooks

  /**
   * @internal
   * This hook is reserved for internal kernel logging infrastructure.
   * Feature modules must never override Logger behavior.
   * Future lifecycle integrations will occur through infrastructure, not inheritance.
   */
  protected beforeLog(
    level: LogLevel,
    message: string,
    metadata?: LogMetadata | Record<string, unknown>,
    error?: Error
  ): void {}

  /**
   * @internal
   * This hook is reserved for internal kernel logging infrastructure.
   * Feature modules must never override Logger behavior.
   * Future lifecycle integrations will occur through infrastructure, not inheritance.
   */
  protected afterLog(entry: LogEntry): void {}

  /**
   * @internal
   * This hook is reserved for internal kernel logging infrastructure.
   * Feature modules must never override Logger behavior.
   * Future lifecycle integrations will occur through infrastructure, not inheritance.
   */
  protected beforeFlush(): void {}

  /**
   * @internal
   * This hook is reserved for internal kernel logging infrastructure.
   * Feature modules must never override Logger behavior.
   * Future lifecycle integrations will occur through infrastructure, not inheritance.
   */
  protected afterFlush(): void {}

  private log(level: LogLevel, message: string, metadata?: LogMetadata | Record<string, unknown>, error?: Error): void {
    if (level < this._config.minLevel) {
      return;
    }

    this.beforeLog(level, message, metadata, error);

    const entry = this._factory.create(level, message, this._context.moduleName, this._context, metadata, error);

    this._config.pipeline.send(entry);

    this.afterLog(entry);
  }

  public trace(message: string, metadata?: LogMetadata | Record<string, unknown>, error?: Error): void {
    this.log(LogLevel.TRACE, message, metadata, error);
  }

  public debug(message: string, metadata?: LogMetadata | Record<string, unknown>, error?: Error): void {
    this.log(LogLevel.DEBUG, message, metadata, error);
  }

  public info(message: string, metadata?: LogMetadata | Record<string, unknown>, error?: Error): void {
    this.log(LogLevel.INFO, message, metadata, error);
  }

  public warn(message: string, metadata?: LogMetadata | Record<string, unknown>, error?: Error): void {
    this.log(LogLevel.WARN, message, metadata, error);
  }

  public error(message: string, metadata?: LogMetadata | Record<string, unknown>, error?: Error): void {
    this.log(LogLevel.ERROR, message, metadata, error);
  }

  public fatal(message: string, metadata?: LogMetadata | Record<string, unknown>, error?: Error): void {
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
    this.beforeFlush();
    await Promise.resolve();
    this.afterFlush();
  }
}
