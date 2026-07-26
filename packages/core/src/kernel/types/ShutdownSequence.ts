export interface ShutdownSequence {
  readonly shutdownOrder: readonly string[];
  readonly timestamp: Date;
}
