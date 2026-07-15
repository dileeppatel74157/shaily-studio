import { SpanContext } from "./SpanContext";

export interface Span {
  readonly id: string;
  readonly name: string;
  readonly context: SpanContext;
  readonly startTime: Date;
  readonly endTime?: Date;
  readonly duration?: number; // duration in milliseconds
  readonly tags: Readonly<Record<string, string>>;
  readonly childSpans: readonly Span[];
}
