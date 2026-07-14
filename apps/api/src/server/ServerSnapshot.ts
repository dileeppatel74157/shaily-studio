import { ServerState } from "./ServerState";

export interface ServerSnapshot {
  readonly id: string;
  readonly environment: string;
  readonly version: string;
  readonly port: number;
  readonly host: string;
  readonly state: ServerState;
  readonly startTime: Date | null;
  readonly uptime: number; // in seconds
  readonly registeredRoutesCount: number;
  readonly registeredMiddlewaresCount: number;
  readonly metadata: Readonly<Record<string, any>>;
}
