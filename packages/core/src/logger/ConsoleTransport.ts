import { LogEntry } from "./LogEntry";
import { LogFormatter } from "./LogFormatter";
import { LogLevel } from "./LogLevel";
import { LogTransport } from "./LogTransport";

export class ConsoleTransport implements LogTransport {
  private readonly _formatter: LogFormatter;
  private readonly _enableColors: boolean;

  constructor(formatter: LogFormatter, enableColors = true) {
    this._formatter = formatter;
    this._enableColors = enableColors;
  }

  public send(entry: LogEntry): void {
    const formatted = this._formatter.format(entry);

    let output = formatted;
    if (this._enableColors) {
      output = this.colorize(formatted, entry.level);
    }

    switch (entry.level) {
      case LogLevel.TRACE:
      case LogLevel.DEBUG:
        // eslint-disable-next-line no-console
        console.debug(output);
        break;
      case LogLevel.INFO:
        // eslint-disable-next-line no-console
        console.info(output);
        break;
      case LogLevel.WARN:
        // eslint-disable-next-line no-console
        console.warn(output);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        // eslint-disable-next-line no-console
        console.error(output);
        break;
      default:
        // eslint-disable-next-line no-console
        console.log(output);
    }
  }

  private colorize(text: string, level: LogLevel): string {
    const esc = "\x1b[";
    const reset = `${esc}0m`;
    switch (level) {
      case LogLevel.TRACE:
        return `${esc}90m${text}${reset}`; // Gray
      case LogLevel.DEBUG:
        return `${esc}36m${text}${reset}`; // Cyan
      case LogLevel.INFO:
        return `${esc}32m${text}${reset}`; // Green
      case LogLevel.WARN:
        return `${esc}33m${text}${reset}`; // Yellow
      case LogLevel.ERROR:
        return `${esc}31m${text}${reset}`; // Red
      case LogLevel.FATAL:
        return `${esc}35m${text}${reset}`; // Magenta
      default:
        return text;
    }
  }
}
