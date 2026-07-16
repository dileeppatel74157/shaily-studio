export interface PlanReasoning {
  readonly objective: string;
  readonly strategy: string;
  readonly steps: ReadonlyArray<string>;
  readonly timestamp: Date;
}
