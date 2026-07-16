import { AIEngineState } from "./AIEngineState";

export interface AIEngineSnapshot {
  readonly id: string;
  readonly state: AIEngineState;
  readonly initializedAt?: Date;
  readonly startedAt?: Date;
  readonly stoppedAt?: Date;
  readonly requestCount: number;
  readonly failureCount: number;
  readonly totalTokenCount: number;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly timestamp: Date;
}
