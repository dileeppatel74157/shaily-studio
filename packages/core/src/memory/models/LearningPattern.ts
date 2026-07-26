export interface LearningPattern {
  readonly id: string;
  readonly name: string;
  readonly type: "repeated-failure" | "repeated-success" | "optimization-opportunity" | "execution-bottleneck" | "tool-reliability" | "provider-reliability" | "workflow-improvement";
  readonly description: string;
  readonly confidence: number;
  readonly occurrences: number;
  readonly metadata?: Record<string, unknown>;
  readonly timestamp: Date;
}
