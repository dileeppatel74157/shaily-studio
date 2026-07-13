import { ILogger } from "../logger/ILogger";
import { Event } from "./Event";
import { EventHandler } from "./EventHandler";
import { EventPipeline } from "./EventPipeline";
import { EventPriority } from "./EventPriority";
import { EventSubscription } from "./EventSubscription";
import { EventBusSnapshot, IEventBus } from "./IEventBus";

export class EventBus implements IEventBus {
  private readonly _subscriptions = new Map<string, EventSubscription[]>();
  private readonly _pipeline: EventPipeline;
  private readonly _logger?: ILogger;

  constructor(logger?: ILogger) {
    this._logger = logger;
    this._pipeline = new EventPipeline(logger);
  }

  public async publish(event: Event): Promise<void> {
    const eventSubs = this._subscriptions.get(event.name) || [];
    if (eventSubs.length === 0) {
      this._logger?.debug(`No subscribers for event "${event.name}" (${event.id}). Skipping.`);
      return;
    }
    await this._pipeline.execute(event, eventSubs);
  }

  public subscribe<TEvent extends Event = Event>(
    eventName: string,
    handler: EventHandler<TEvent>,
    priority: EventPriority = EventPriority.NORMAL
  ): EventSubscription {
    const id = "sub-" + Math.random().toString(36).substr(2, 9);

    const subscription: EventSubscription = {
      id,
      eventName,
      handler,
      priority,
      unsubscribe: () => this.unsubscribe(id),
    };

    const list = this._subscriptions.get(eventName) || [];
    list.push(subscription);
    this._subscriptions.set(eventName, list);

    this._logger?.debug(
      `Subscribed handler to event "${eventName}" with priority ${EventPriority[priority]} (Subscription: ${id}).`
    );
    return subscription;
  }

  public unsubscribe(subscriptionId: string): boolean {
    for (const [eventName, list] of this._subscriptions.entries()) {
      const index = list.findIndex((sub) => sub.id === subscriptionId);
      if (index !== -1) {
        list.splice(index, 1);
        if (list.length === 0) {
          this._subscriptions.delete(eventName);
        } else {
          this._subscriptions.set(eventName, list);
        }
        this._logger?.debug(`Unsubscribed subscription: ${subscriptionId}.`);
        return true;
      }
    }
    return false;
  }

  public hasSubscribers(eventName: string): boolean {
    const list = this._subscriptions.get(eventName);
    return !!list && list.length > 0;
  }

  public clear(): void {
    this._subscriptions.clear();
    this._logger?.debug("Cleared all EventBus subscriptions.");
  }

  public snapshot(): EventBusSnapshot {
    const eventNames = Array.from(this._subscriptions.keys());
    let total = 0;
    const subscriptionsByEvent: Record<string, number> = {};

    for (const [name, list] of this._subscriptions.entries()) {
      total += list.length;
      subscriptionsByEvent[name] = list.length;
    }

    return Object.freeze({
      timestamp: new Date(),
      eventNames: Object.freeze(eventNames),
      subscriptionCount: total,
      subscriptionsByEvent: Object.freeze(subscriptionsByEvent),
    });
  }
}
