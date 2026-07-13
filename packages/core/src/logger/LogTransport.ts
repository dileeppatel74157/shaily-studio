import { LogEntry } from "./LogEntry";

export interface LogTransport {
  send(entry: LogEntry): void;
}
