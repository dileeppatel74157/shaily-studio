import { DecisionReason } from "./DecisionReason";

export interface DecisionExplanation {
  readonly decisionId: string;
  readonly selectedOptionId: string;
  readonly rationale: string;
  readonly scoreBreakdown: Record<string, number>;
  readonly riskAnalysis: string;
  readonly reasons: ReadonlyArray<DecisionReason>;
}
