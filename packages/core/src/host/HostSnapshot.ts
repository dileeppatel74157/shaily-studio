import { HostState } from "./HostState";
import { HostedService } from "./HostedService";

export interface HostSnapshot {
  readonly timestamp: Date;
  readonly state: HostState;
  readonly services: readonly HostedService[];
  readonly metadata: Readonly<Record<string, unknown>>;
}
