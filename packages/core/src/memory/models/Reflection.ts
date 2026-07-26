export interface Reflection {
  readonly id: string;
  readonly executionId?: string;
  readonly lessons: ReadonlyArray<string>;
  readonly mistakes: ReadonlyArray<string>;
  readonly optimizations: ReadonlyArray<string>;
  readonly recommendations: ReadonlyArray<string>;
  readonly timestamp: Date;
}
