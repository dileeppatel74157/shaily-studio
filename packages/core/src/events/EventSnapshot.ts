import { EventState } from "./EventState";

export interface EventSnapshot {
  readonly state: EventState;
  readonly timestamp: Date;
  readonly eventNames: ReadonlyArray<string>;
  readonly subscriptionCount: number;
  readonly subscriptionsByEvent: Record<string, number>;
  readonly publishCount: number;
}
