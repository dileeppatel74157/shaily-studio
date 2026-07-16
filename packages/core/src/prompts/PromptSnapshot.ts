import { PromptState } from "./PromptState";

export interface PromptSnapshot {
  readonly id: string;
  readonly state: PromptState;
  readonly initializedAt?: Date;
  readonly startedAt?: Date;
  readonly stoppedAt?: Date;
  readonly templateCount: number;
  readonly renderedCount: number;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly timestamp: Date;

  // Backward compatibility
  readonly promptsCount: number;
}
