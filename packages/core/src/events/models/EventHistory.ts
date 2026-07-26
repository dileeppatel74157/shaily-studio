import { Event } from "./Event";

export class EventHistory {
  private readonly _events: Event[] = [];
  private readonly _maxSize: number;

  constructor(maxSize = 1000) {
    this._maxSize = maxSize;
  }

  public add(event: Event): void {
    this._events.push(event);
    if (this._events.length > this._maxSize) {
      this._events.shift();
    }
  }

  public get all(): ReadonlyArray<Event> {
    return Object.freeze([...this._events]);
  }

  public getByCorrelationId(correlationId: string): Event[] {
    return this._events.filter(e => e.correlationId === correlationId);
  }

  public clear(): void {
    this._events.length = 0;
  }
}
