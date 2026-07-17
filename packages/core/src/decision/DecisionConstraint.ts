import { DecisionOption } from "./DecisionOption";

export interface DecisionConstraint {
  readonly id: string;
  readonly name: string;
  readonly type: "cost" | "risk" | "custom";
  readonly value: any;
  validate(option: DecisionOption): boolean;
}
