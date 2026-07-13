import { Event } from "./Event";
import { EventHandler } from "./EventHandler";
import { EventPriority } from "./EventPriority";
import { EventSubscription } from "./EventSubscription";

export interface EventBusSnapshot {
  readonly timestamp: Date;
  readonly eventNames: ReadonlyArray<string>;
  readonly subscriptionCount: number;
  readonly subscriptionsByEvent: Record<string, number>;
}

export interface IEventBus {
  publish(event: Event): Promise<void>;
  subscribe<TEvent extends Event = Event>(
    eventName: string,
    handler: EventHandler<TEvent>,
    priority?: EventPriority
  ): EventSubscription;
  unsubscribe(subscriptionId: string): boolean;
  hasSubscribers(eventName: string): boolean;
  clear(): void;
  snapshot(): EventBusSnapshot;
}
