import { StudioState } from "./StudioState";

export interface StudioSnapshot {
  readonly timestamp: Date;
  readonly state: StudioState;
  readonly runtime: any;
  readonly host: any;
  readonly bootstrapper: any;
  readonly kernel: any;
  readonly registeredFrameworks: readonly string[];
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly capabilities: readonly string[];
}
