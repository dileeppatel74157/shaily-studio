import { LogEntry } from "./LogEntry";
import { LogTransport } from "./LogTransport";

export interface TransportFailureHandler {
  handleFailure(error: Error, entry: LogEntry, transport: LogTransport): void;
}

export class TransportPipeline {
  private readonly _transports: LogTransport[];
  private readonly _failureHandlers: TransportFailureHandler[] = [];

  constructor(transports: LogTransport[]) {
    this._transports = [...transports];
  }

  public registerFailureHandler(handler: TransportFailureHandler): void {
    this._failureHandlers.push(handler);
  }

  public send(entry: LogEntry): void {
    for (const transport of this._transports) {
      try {
        transport.send(entry);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.reportFailure(err, entry, transport);
      }
    }
  }

  private reportFailure(error: Error, entry: LogEntry, transport: LogTransport): void {
    if (this._failureHandlers.length > 0) {
      for (const handler of this._failureHandlers) {
        try {
          handler.handleFailure(error, entry, transport);
        } catch (handlerErr) {
          // eslint-disable-next-line no-console
          console.error(`Transport failure handler crashed: ${handlerErr}`);
        }
      }
    } else {
      // eslint-disable-next-line no-console
      console.error(
        `Transport failed: ${error.message} for log entry ${entry.id} on transport ${transport.constructor.name}`
      );
    }
  }
}
