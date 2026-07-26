import { KernelState } from "./KernelState";

export interface KernelLifecycle {
  readonly state: KernelState;
  readonly initializedAt?: Date;
  readonly startedAt?: Date;
  readonly stoppedAt?: Date;
}
