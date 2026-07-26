import { Event } from "../models/Event";

export type EventFilter = (event: Event) => boolean | Promise<boolean>;
