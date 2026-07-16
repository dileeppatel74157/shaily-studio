import { Event } from "./Event";
import { EventPublisher } from "./EventPublisher";
import { EventSubscriber } from "./EventSubscriber";
import { EventSnapshot } from "./EventSnapshot";
import { EventState } from "./EventState";

export interface IEventBus extends EventPublisher, EventSubscriber {
  readonly state: EventState;
  hasSubscribers(eventName: string): boolean;
  clear(): void;
  snapshot(): EventSnapshot;
  use(middleware: (event: Event, next: () => Promise<void>) => Promise<void>): void;
}
