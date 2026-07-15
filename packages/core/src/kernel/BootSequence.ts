export interface BootSequence {
  readonly startupOrder: readonly string[];
  readonly timestamp: Date;
}
