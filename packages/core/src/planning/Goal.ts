import { GoalPriority } from "./GoalPriority";
import { GoalStatus } from "./GoalStatus";
import { GoalType } from "./GoalType";

export interface Goal {
  readonly id: string;
  readonly description: string;
  readonly priority: GoalPriority;
  readonly type: GoalType;
  readonly status: GoalStatus;
  readonly parentId?: string;
  readonly dependencies?: ReadonlyArray<string>;
}
