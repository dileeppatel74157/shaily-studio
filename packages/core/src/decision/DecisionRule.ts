import { DecisionOption } from "./DecisionOption";
import { DecisionContext } from "./DecisionContext";

export interface DecisionRule {
  readonly id: string;
  readonly name: string;
  readonly condition: (option: DecisionOption, context: DecisionContext) => boolean;
  readonly action: "include" | "exclude" | "boost" | "penalize";
  readonly value?: number;
  readonly dependsOnRuleId?: string;
}
