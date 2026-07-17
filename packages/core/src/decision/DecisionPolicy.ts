import { IDecisionPolicy } from "./IDecisionPolicy";
import { DecisionRule } from "./DecisionRule";
import { DecisionOption } from "./DecisionOption";
import { DecisionContext } from "./DecisionContext";

export class DecisionPolicy implements IDecisionPolicy {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly rules: ReadonlyArray<DecisionRule> = []
  ) {}

  public evaluate(
    options: ReadonlyArray<DecisionOption>,
    context: DecisionContext
  ): ReadonlyArray<DecisionOption> {
    let result = [...options];

    for (const rule of this.rules) {
      if (rule.action === "exclude") {
        result = result.filter((opt) => !rule.condition(opt, context));
      } else if (rule.action === "include") {
        const matched = options.filter((opt) => rule.condition(opt, context));
        for (const opt of matched) {
          if (!result.find((o) => o.id === opt.id)) {
            result.push(opt);
          }
        }
      }
    }

    return result;
  }
}
