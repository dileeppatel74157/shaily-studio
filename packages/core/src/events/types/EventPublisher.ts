import { Event } from "../models/Event";

export interface EventPublisher {
  publish(event: Event): Promise<void>;
}
