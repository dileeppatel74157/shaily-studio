export interface DecisionReason {
  readonly code: string;
  readonly description: string;
  readonly scoreImpact?: number;
}
