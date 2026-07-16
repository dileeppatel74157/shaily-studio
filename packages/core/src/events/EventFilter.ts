import { Event } from "./Event";

export type EventFilter = (event: Event) => boolean | Promise<boolean>;
