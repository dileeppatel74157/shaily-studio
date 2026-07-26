import { RuntimeState } from "./RuntimeState";

export interface RuntimeLifecycle {
  readonly state: RuntimeState;
  readonly initializedAt?: Date;
  readonly startedAt?: Date;
  readonly stoppedAt?: Date;
}
