import { EventHandler } from "./EventHandler";
import { EventPriority } from "./EventPriority";
import { EventFilter } from "./EventFilter";

export interface EventSubscription {
  readonly id: string;
  readonly eventName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly handler: EventHandler<any>;
  readonly priority: EventPriority;
  readonly filter?: EventFilter;
  unsubscribe(): boolean;
}
