import { DecisionOption } from "./DecisionOption";
import { DecisionContext } from "./DecisionContext";
import { DecisionRule } from "./DecisionRule";

export interface IDecisionPolicy {
  readonly id: string;
  readonly name: string;
  readonly rules: ReadonlyArray<DecisionRule>;
  evaluate(options: ReadonlyArray<DecisionOption>, context: DecisionContext): ReadonlyArray<DecisionOption>;
}
