export enum ReadinessStatus {
  PASS = "PASS",
  WARNING = "WARNING",
  FAIL = "FAIL",
  SKIPPED = "SKIPPED",
}

export interface ReadinessResult {
  readonly id: string;
  readonly name: string;
  readonly status: ReadinessStatus;
  readonly duration: number;
  readonly message: string;
  readonly details: Readonly<Record<string, unknown>>;
}
