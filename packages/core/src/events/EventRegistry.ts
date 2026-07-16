import { EventHandler } from "./EventHandler";
import { EventPriority } from "./EventPriority";
import { EventSubscription } from "./EventSubscription";
import { EventFilter } from "./EventFilter";
import { Event } from "./Event";

function matchWildcard(pattern: string, name: string): boolean {
  if (pattern === "*" || pattern === "") return true;
  const escaped = pattern.replace(/[\-\[\]\/\{\}\(\)\+\?\.\\\^\$\|]/g, "\\$&");
  const regexPattern = "^" + escaped.replace(/\*/g, ".*") + "$";
  const regex = new RegExp(regexPattern);
  return regex.test(name);
}

export class EventRegistry {
  private readonly _subscriptions = new Map<string, EventSubscription[]>();

  public register<TEvent extends Event = Event>(
    eventName: string,
    handler: EventHandler<TEvent>,
    priority: EventPriority = EventPriority.NORMAL,
    filter?: EventFilter
  ): EventSubscription {
    const id = "sub-" + Math.random().toString(36).substring(2, 11);
    
    const subscription: EventSubscription = {
      id,
      eventName,
      handler,
      priority,
      filter,
      unsubscribe: () => this.unregister(id),
    };

    const list = this._subscriptions.get(eventName) || [];
    list.push(subscription);
    this._subscriptions.set(eventName, list);
    return subscription;
  }

  public unregister(subscriptionId: string): boolean {
    for (const [eventName, list] of this._subscriptions.entries()) {
      const idx = list.findIndex(sub => sub.id === subscriptionId);
      if (idx !== -1) {
        list.splice(idx, 1);
        if (list.length === 0) {
          this._subscriptions.delete(eventName);
        } else {
          this._subscriptions.set(eventName, list);
        }
        return true;
      }
    }
    return false;
  }

  public getSubscriptions(eventName: string): EventSubscription[] {
    const matched: EventSubscription[] = [];
    for (const [pattern, list] of this._subscriptions.entries()) {
      if (matchWildcard(pattern, eventName)) {
        matched.push(...list);
      }
    }
    return matched;
  }

  public hasSubscribers(eventName: string): boolean {
    return this.getSubscriptions(eventName).length > 0;
  }

  public clear(): void {
    this._subscriptions.clear();
  }

  public getEventNames(): string[] {
    return Array.from(this._subscriptions.keys());
  }

  public get subscriptionsCount(): number {
    let total = 0;
    for (const list of this._subscriptions.values()) {
      total += list.length;
    }
    return total;
  }

  public get subscriptionsByEvent(): Record<string, number> {
    const map: Record<string, number> = {};
    for (const [name, list] of this._subscriptions.entries()) {
      map[name] = list.length;
    }
    return map;
  }
}
