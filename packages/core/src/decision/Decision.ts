import { DecisionState } from "./DecisionState";
import { DecisionPriority } from "./DecisionPriority";
import { DecisionStrategy } from "./DecisionStrategy";
import { DecisionType } from "./DecisionType";
import { DecisionOption } from "./DecisionOption";
import { DecisionCriteria } from "./DecisionCriteria";
import { DecisionConstraint } from "./DecisionConstraint";
import { DecisionPolicy } from "./DecisionPolicy";
import { DecisionContext } from "./DecisionContext";
import { DecisionExplanation } from "./DecisionExplanation";
import { DecisionConfidence } from "./DecisionConfidence";

export interface Decision {
  readonly id: string;
  readonly type: DecisionType;
  readonly priority: DecisionPriority;
  readonly strategy: DecisionStrategy;
  readonly state: DecisionState;
  readonly options: ReadonlyArray<DecisionOption>;
  readonly criteria: ReadonlyArray<DecisionCriteria>;
  readonly constraints: ReadonlyArray<DecisionConstraint>;
  readonly policies: ReadonlyArray<DecisionPolicy>;
  readonly context: DecisionContext;
  readonly selectedOptionId?: string;
  readonly confidence?: DecisionConfidence;
  readonly explanation?: DecisionExplanation;
  readonly timestamp: Date;
  readonly fallbackOptionId?: string;
  readonly maxRetries?: number;
  readonly retriesCount?: number;
}
