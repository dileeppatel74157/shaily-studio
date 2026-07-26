import { Event } from "../models/Event";

export type EventHandler<TEvent extends Event = Event> = (event: TEvent) => void | Promise<void>;
