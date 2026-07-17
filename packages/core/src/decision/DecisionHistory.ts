import { DecisionType } from "./DecisionType";

export interface DecisionHistory {
  readonly decisionId: string;
  readonly timestamp: Date;
  readonly type: DecisionType;
  readonly optionsCount: number;
  readonly selectedOptionId: string;
  readonly confidence: number;
  readonly successRate?: number;
}
