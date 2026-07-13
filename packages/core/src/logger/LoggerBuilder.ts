import { ILogger } from "./ILogger";
import { LogFormatter } from "./LogFormatter";
import { LogLevel } from "./LogLevel";
import { LogTransport } from "./LogTransport";
import { Logger } from "./Logger";
import { LoggerConfig } from "./LoggerConfig";
import { LoggerContext } from "./LoggerContext";

export class LoggerBuilder {
  private _minLevel: LogLevel = LogLevel.INFO;
  private readonly _transports: LogTransport[] = [];
  private _formatter?: LogFormatter;
  private _timestampFormat = "ISO";
  private _enableColors = true;
  private _moduleName = "root";
  private _kernelId?: string;

  public withMinLevel(level: LogLevel): this {
    this._minLevel = level;
    return this;
  }

  public addTransport(transport: LogTransport): this {
    this._transports.push(transport);
    return this;
  }

  public withFormatter(formatter: LogFormatter): this {
    this._formatter = formatter;
    return this;
  }

  public withTimestampFormat(format: string): this {
    this._timestampFormat = format;
    return this;
  }

  public withColors(enable: boolean): this {
    this._enableColors = enable;
    return this;
  }

  public withModule(moduleName: string): this {
    this._moduleName = moduleName;
    return this;
  }

  public withKernelId(kernelId: string): this {
    this._kernelId = kernelId;
    return this;
  }

  public build(): ILogger {
    if (!this._formatter) {
      throw new Error("Logger must be configured with a LogFormatter before building.");
    }
    if (this._transports.length === 0) {
      throw new Error("Logger must have at least one LogTransport registered.");
    }

    const config: LoggerConfig = {
      minLevel: this._minLevel,
      transports: this._transports,
      formatter: this._formatter,
      timestampFormat: this._timestampFormat,
      enableColors: this._enableColors,
    };

    const context: LoggerContext = {
      moduleName: this._moduleName,
      kernelId: this._kernelId,
    };

    return new Logger(config, context);
  }
}
