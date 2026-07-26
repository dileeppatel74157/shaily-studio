import { Event } from "../models/Event";
import { EventPublisher } from "../types/EventPublisher";
import { EventSubscriber } from "../types/EventSubscriber";
import { EventSnapshot } from "../models/EventSnapshot";
import { EventState } from "../types/EventState";

export interface IEventBus extends EventPublisher, EventSubscriber {
  readonly state: EventState;
  hasSubscribers(eventName: string): boolean;
  clear(): void;
  snapshot(): EventSnapshot;
  use(middleware: (event: Event, next: () => Promise<void>) => Promise<void>): void;
}
