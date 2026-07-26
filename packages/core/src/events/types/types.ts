export { Event } from "../models/Event";
export { EventHandler } from "./EventHandler";
export { EventMetadata } from "../models/EventMetadata";
export { EventPriority } from "./EventPriority";
export { EventSubscription } from "./EventSubscription";
export { EventFilter } from "./EventFilter";
export { EventContext } from "../models/EventContext";
export { EventState } from "./EventState";
export { EventSnapshot } from "../models/EventSnapshot";

export class EventException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidEventStateException extends EventException {
  constructor(action: string, currentState: string) {
    super(`Cannot perform "${action}" while EventBus is in "${currentState}" state.`);
  }
}

export class EventValidationException extends EventException {
  constructor(message: string) {
    super(message);
  }
}
