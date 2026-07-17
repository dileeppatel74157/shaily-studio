import { DecisionState } from "./DecisionState";
import { DecisionOption } from "./DecisionOption";
import { DecisionType } from "./DecisionType";

export interface DecisionSnapshot {
  readonly id: string;
  readonly type: DecisionType;
  readonly state: DecisionState;
  readonly options: ReadonlyArray<DecisionOption>;
  readonly selectedOptionId?: string;
  readonly confidence?: number;
  readonly timestamp: Date;
}
