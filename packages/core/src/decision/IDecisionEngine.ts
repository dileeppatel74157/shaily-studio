import { Decision } from "./Decision";
import { DecisionOutcome } from "./DecisionOutcome";
import { DecisionHistory } from "./DecisionHistory";
import { DecisionSnapshot } from "./DecisionSnapshot";
import { DecisionType } from "./DecisionType";

export interface IDecisionEngine {
  evaluate(decision: Decision): Promise<Decision>;
  recordOutcome(outcome: DecisionOutcome): Promise<void>;
  getHistory(type?: DecisionType): Promise<ReadonlyArray<DecisionHistory>>;
  snapshot(): ReadonlyArray<DecisionSnapshot>;
}
