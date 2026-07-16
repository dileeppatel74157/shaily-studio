import { Event } from "./Event";

export class EventValidator {
  public static validateEvent(event: Event): void {
    if (!event) {
      throw new Error("Event is null or undefined.");
    }
    if (!event.id || typeof event.id !== "string" || event.id.trim() === "") {
      throw new Error("Event ID must be a non-empty string.");
    }
    if (!event.name || typeof event.name !== "string" || event.name.trim() === "") {
      throw new Error("Event name must be a non-empty string.");
    }
    if (!(event.timestamp instanceof Date) || isNaN(event.timestamp.getTime())) {
      throw new Error("Event timestamp must be a valid Date object.");
    }
    if (event.correlationId === undefined || event.correlationId === null) {
      throw new Error("Event correlationId is required.");
    }
  }
}
