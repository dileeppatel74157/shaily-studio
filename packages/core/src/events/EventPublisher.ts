import { Event } from "./Event";

export interface EventPublisher {
  publish(event: Event): Promise<void>;
}
