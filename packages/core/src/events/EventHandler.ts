import { Event } from "./Event";

export type EventHandler<TEvent extends Event = Event> = (event: TEvent) => void | Promise<void>;
