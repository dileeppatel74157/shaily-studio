import { Event } from "./Event";
import { EventSubscription } from "./EventSubscription";
import { EventHandler } from "./EventHandler";
import { EventPriority } from "./EventPriority";
import { EventFilter } from "./EventFilter";

export interface EventSubscriber {
  subscribe<TEvent extends Event = Event>(
    eventName: string,
    handler: EventHandler<TEvent>,
    priority?: EventPriority,
    filter?: EventFilter
  ): EventSubscription;
  unsubscribe(subscriptionId: string): boolean;
  once<TEvent extends Event = Event>(
    eventName: string,
    handler: EventHandler<TEvent>,
    priority?: EventPriority,
    filter?: EventFilter
  ): EventSubscription;
}
