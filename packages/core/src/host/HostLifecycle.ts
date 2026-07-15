import { HostState } from "./HostState";

export interface HostLifecycle {
  readonly state: HostState;
  readonly initializedAt?: Date;
  readonly startedAt?: Date;
  readonly stoppedAt?: Date;
}
