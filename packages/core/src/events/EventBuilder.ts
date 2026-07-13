import { Event } from "./Event";
import { EventMetadata } from "./EventMetadata";

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class EventBuilder<TPayload = any> {
  private _name?: string;
  private _correlationId = generateUUID();
  private _source = "system";
  private _payload!: TPayload;
  private _metadata: EventMetadata = {};

  public withName(name: string): this {
    this._name = name;
    return this;
  }

  public withCorrelationId(correlationId: string): this {
    this._correlationId = correlationId;
    return this;
  }

  public withSource(source: string): this {
    this._source = source;
    return this;
  }

  public withPayload(payload: TPayload): this {
    this._payload = payload;
    return this;
  }

  public withMetadata(metadata: EventMetadata): this {
    this._metadata = { ...metadata };
    return this;
  }

  public build(): Event<TPayload> {
    if (!this._name) {
      throw new Error("Event name is required to build an Event.");
    }

    const entry: Event<TPayload> = {
      id: generateUUID(),
      name: this._name,
      timestamp: new Date(),
      correlationId: this._correlationId,
      source: this._source,
      payload: this._payload ? Object.freeze(JSON.parse(JSON.stringify(this._payload))) : undefined,
      metadata: Object.freeze(JSON.parse(JSON.stringify(this._metadata))),
    };

    return Object.freeze(entry);
  }
}
