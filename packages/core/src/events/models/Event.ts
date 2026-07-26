import { EventMetadata } from "./EventMetadata";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Event<TPayload = any> {
  readonly id: string;
  readonly name: string;
  readonly timestamp: Date;
  readonly correlationId: string;
  readonly source: string;
  readonly payload: TPayload;
  readonly metadata: EventMetadata;
}
