export interface DecisionOutcome {
  readonly decisionId: string;
  readonly selectedOptionId: string;
  readonly success: boolean;
  readonly feedback?: string;
  readonly metrics?: {
    readonly actualCost?: number;
    readonly actualReward?: number;
    readonly executionTimeMs?: number;
  };
  readonly timestamp: Date;
}
