import { DecisionRisk } from "./DecisionRisk";
import { DecisionScore } from "./DecisionScore";

export interface DecisionOption {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly cost: number;
  readonly reward: number;
  readonly risk: DecisionRisk;
  readonly scores?: DecisionScore;
  readonly metadata?: Record<string, unknown>;
}
