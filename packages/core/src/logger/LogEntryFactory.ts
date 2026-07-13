import { Clock } from "./Clock";
import { LogEntry } from "./LogEntry";
import { LogLevel } from "./LogLevel";
import { LogMetadata } from "./LogMetadata";
import { LoggerContext } from "./LoggerContext";

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
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

export class LogEntryFactory {
  private readonly _clock: Clock;

  constructor(clock: Clock) {
    this._clock = clock;
  }

  public create(
    level: LogLevel,
    message: string,
    module: string,
    context: LoggerContext,
    metadata?: LogMetadata | Record<string, unknown>,
    error?: Error
  ): LogEntry {
    const id = generateUUID();
    const timestamp = this._clock.now();

    let normalizedMetadata: LogMetadata;
    if (metadata instanceof LogMetadata) {
      normalizedMetadata = metadata;
    } else {
      normalizedMetadata = new LogMetadata(metadata || {});
    }

    let serializedError: Error | undefined = undefined;
    if (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const serialized = serializeError(error) as any;
      const frozenError = new Error(serialized.message);
      Object.defineProperties(frozenError, {
        name: { value: serialized.name, enumerable: true, writable: false, configurable: false },
        stack: { value: serialized.stack, enumerable: true, writable: false, configurable: false },
        cause: { value: serialized.cause, enumerable: true, writable: false, configurable: false },
      });
      serializedError = Object.freeze(frozenError);
    }

    const frozenContext = Object.freeze(JSON.parse(JSON.stringify(context)));

    const entry: LogEntry = {
      id,
      timestamp,
      level,
      message,
      module,
      context: frozenContext,
      metadata: normalizedMetadata,
      error: serializedError,
    };

    return Object.freeze(entry);
  }
}
