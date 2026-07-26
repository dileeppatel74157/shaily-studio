import { LogEntry } from "../models/LogEntry";

export interface LogTransport {
  send(entry: LogEntry): void;
}
