import { LogEntry } from "./LogEntry";
import { LogLevel } from "./LogLevel";

export interface LogFormatter {
  format(entry: LogEntry): string;
}

function serializeError(err: unknown): unknown {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      cause: err.cause ? serializeError(err.cause) : undefined,
    };
  }
  return err;
}

export class JsonFormatter implements LogFormatter {
  public format(entry: LogEntry): string {
    const payload: Record<string, unknown> = {
      id: entry.id,
      timestamp: entry.timestamp.toISOString(),
      level: LogLevel[entry.level],
      message: entry.message,
      module: entry.module,
      context: entry.context,
    };
    if (entry.metadata) {
      payload.metadata = entry.metadata;
    }
    if (entry.error) {
      payload.error = serializeError(entry.error);
    }
    return JSON.stringify(payload);
  }
}

export class PrettyConsoleFormatter implements LogFormatter {
  public format(entry: LogEntry): string {
    const time = entry.timestamp.toISOString();
    const levelStr = LogLevel[entry.level].padEnd(5);
    let out = `[${time}] ${levelStr} [${entry.module}] ${entry.message}`;

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      out += ` | metadata: ${JSON.stringify(entry.metadata)}`;
    }
    // Context contains at least the moduleName key, so check if there are other keys
    if (entry.context && Object.keys(entry.context).length > 1) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { moduleName, ...extraContext } = entry.context;
      if (Object.keys(extraContext).length > 0) {
        out += ` | context: ${JSON.stringify(extraContext)}`;
      }
    }
    if (entry.error) {
      out += `\nError: ${entry.error.name}: ${entry.error.message}`;
      if (entry.error.stack) {
        out += `\n${entry.error.stack}`;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((entry.error as any).cause) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        out += `\nCause: ${JSON.stringify((entry.error as any).cause)}`;
      }
    }
    return out;
  }
}
