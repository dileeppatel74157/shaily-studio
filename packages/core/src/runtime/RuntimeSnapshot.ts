import { RuntimeState } from "./RuntimeState";
import { RuntimeSession } from "./RuntimeSession";

export interface RuntimeSnapshot {
  readonly timestamp: Date;
  readonly state: RuntimeState;
  readonly sessions: readonly RuntimeSession[];
  readonly metadata: Readonly<Record<string, unknown>>;
}
