import { ILogger } from "../logger/ILogger";
import { Event } from "./Event";
import { EventSubscription } from "./EventSubscription";

export class EventPipeline {
  private readonly _logger?: ILogger;

  constructor(logger?: ILogger) {
    this._logger = logger;
  }

  public async execute(event: Event, subscriptions: EventSubscription[]): Promise<void> {
    const sorted = [...subscriptions].sort((a, b) => b.priority - a.priority);

    this._logger?.debug(
      `Executing event pipeline for event "${event.name}" (${event.id}) with ${sorted.length} handlers.`
    );

    for (const sub of sorted) {
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
}
