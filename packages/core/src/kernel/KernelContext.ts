import { KernelState } from "./KernelState";

export interface KernelContext {
  readonly state: KernelState;
  readonly startTime: Date | null;
  readonly registeredServices: string[];
  readonly version: string;
  readonly environment: string;
}
