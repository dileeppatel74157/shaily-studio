export interface Experience {
  readonly id: string;
  readonly description: string;
  readonly outcome: "success" | "failure";
  readonly steps: ReadonlyArray<string>;
  readonly durationMs?: number;
  readonly timestamp: Date;
}
