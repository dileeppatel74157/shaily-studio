import { Span } from "./Span";

export interface Trace {
  readonly id: string;
  readonly rootSpan: Span;
  readonly correlationId: string;
  readonly timestamp: Date;
}
