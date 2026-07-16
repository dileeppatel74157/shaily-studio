import { ILogger } from "../logger/ILogger";
import { Event } from "./Event";
import { EventHandler } from "./EventHandler";
import { EventPriority } from "./EventPriority";
import { EventSubscription } from "./EventSubscription";
import { IEventBus } from "./IEventBus";
import { EventSnapshot } from "./EventSnapshot";
import { EventState } from "./EventState";
import { EventFilter } from "./EventFilter";
import { EventRegistry } from "./EventRegistry";
import { EventHistory } from "./EventHistory";
import { EventValidator } from "./EventValidator";

export class EventBus implements IEventBus {
  private _state: EventState = EventState.CREATED;
  private readonly _registry = new EventRegistry();
  private readonly _history = new EventHistory();
  private readonly _middlewares: ((event: Event, next: () => Promise<void>) => Promise<void>)[] = [];
  private readonly _logger?: ILogger;
  private _publishCount = 0;

  constructor(logger?: ILogger) {
    this._logger = logger;
    this._state = EventState.INITIALIZED;
    this._state = EventState.RUNNING;
  }

  public get state(): EventState {
    return this._state;
  }

  public get history(): EventHistory {
    return this._history;
  }

  public use(middleware: (event: Event, next: () => Promise<void>) => Promise<void>): void {
    if (this._state !== EventState.RUNNING) {
      throw new Error(`Cannot register middleware when EventBus is in state "${this._state}".`);
    }
    this._middlewares.push(middleware);
  }

  public async publish(event: Event): Promise<void> {
    if (this._state !== EventState.RUNNING) {
      throw new Error(`Cannot publish event "${event.name}" because EventBus is in state "${this._state}".`);
    }

    EventValidator.validateEvent(event);
    this._publishCount++;
    this._history.add(event);

    const subscriptions = this._registry.getSubscriptions(event.name);
    if (subscriptions.length === 0) {
      this._logger?.debug(`No subscribers for event "${event.name}" (${event.id}). Skipping.`);
      return;
    }

    const sorted = [...subscriptions].sort((a, b) => b.priority - a.priority);

    let idx = 0;
    const runMiddleware = async (): Promise<void> => {
      if (idx < this._middlewares.length) {
        const mw = this._middlewares[idx++];
        await mw(event, runMiddleware);
      } else {
        for (const sub of sorted) {
          if (sub.filter) {
            const shouldProcess = await Promise.resolve(sub.filter(event));
            if (!shouldProcess) {
              this._logger?.debug(`Subscription ${sub.id} filtered out event "${event.name}".`);
              continue;
            }
          }
          try {
            await Promise.resolve(sub.handler(event));
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            this._logger?.error(
              `Handler failure for event "${event.name}" inside subscription ${sub.id}: ${err.message}`,
              { eventId: event.id, subscriptionId: sub.id },
              err
            );
          }
        }
      }
    };

    await runMiddleware();
  }

  public subscribe<TEvent extends Event = Event>(
    eventName: string,
    handler: EventHandler<TEvent>,
    priority: EventPriority = EventPriority.NORMAL,
    filter?: EventFilter
  ): EventSubscription {
    if (this._state !== EventState.RUNNING) {
      throw new Error(`Cannot subscribe to event "${eventName}" because EventBus is in state "${this._state}".`);
    }
    if (!eventName || eventName.trim() === "") {
      throw new Error("Event name is required to subscribe.");
    }
    if (!handler) {
      throw new Error("Handler is required to subscribe.");
    }

    const sub = this._registry.register(eventName, handler, priority, filter);
    this._logger?.debug(
      `Subscribed handler to event "${eventName}" with priority ${EventPriority[priority]} (Subscription: ${sub.id}).`
    );
    return sub;
  }

  public unsubscribe(subscriptionId: string): boolean {
    const success = this._registry.unregister(subscriptionId);
    if (success) {
      this._logger?.debug(`Unsubscribed subscription: ${subscriptionId}.`);
    }
    return success;
  }

  public once<TEvent extends Event = Event>(
    eventName: string,
    handler: EventHandler<TEvent>,
    priority: EventPriority = EventPriority.NORMAL,
    filter?: EventFilter
  ): EventSubscription {
    let sub: EventSubscription;
    const onceHandler = async (event: TEvent) => {
      this.unsubscribe(sub.id);
      await Promise.resolve(handler(event));
    };
    sub = this.subscribe(eventName, onceHandler, priority, filter);
    return sub;
  }

  public hasSubscribers(eventName: string): boolean {
    return this._registry.hasSubscribers(eventName);
  }

  public clear(): void {
    this._registry.clear();
    this._logger?.debug("Cleared all EventBus subscriptions.");
  }

  public snapshot(): EventSnapshot {
    return Object.freeze({
      state: this._state,
      timestamp: new Date(),
      eventNames: Object.freeze(this._registry.getEventNames()),
      subscriptionCount: this._registry.subscriptionsCount,
      subscriptionsByEvent: Object.freeze(this._registry.subscriptionsByEvent),
      publishCount: this._publishCount,
    });
  }
}
