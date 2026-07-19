import { ScheduleType } from "./ScheduleType";
import { ScheduleTrigger } from "./ScheduleTrigger";
import { SchedulePolicy } from "./SchedulePolicy";

export interface Schedule {
  readonly id: string;
  readonly name: string;
  readonly type: ScheduleType;
  readonly trigger: ScheduleTrigger;
  readonly policy: SchedulePolicy;
  readonly handlerName: string;
  readonly priority: number;
  readonly enabled: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
