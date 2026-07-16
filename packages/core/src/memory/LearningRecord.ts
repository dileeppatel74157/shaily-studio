export interface LearningRecord {
  readonly id: string;
  readonly sourceId: string;
  readonly sourceType: "execution" | "failure" | "retry" | "feedback" | "tool" | "workflow";
  readonly description: string;
  readonly lessons: ReadonlyArray<string>;
  readonly timestamp: Date;
}
