import { StudioState } from "./StudioState";

export interface StudioSnapshot {
  readonly id: string;
  readonly version: string;
  readonly environment: string;
  readonly state: StudioState;
  readonly startTime: Date | null;
  readonly uptime: number; // in seconds
  readonly registeredServicesCount: number;
}
