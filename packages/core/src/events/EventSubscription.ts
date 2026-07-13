import { EventHandler } from "./EventHandler";
import { EventPriority } from "./EventPriority";

export interface EventSubscription {
  readonly id: string;
  readonly eventName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly handler: EventHandler<any>;
  readonly priority: EventPriority;
  unsubscribe(): void;
}
