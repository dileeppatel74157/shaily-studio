import { SkillState } from "./SkillState";

export interface SkillExecution {
  readonly id: string;
  readonly skillId: string;
  readonly input: unknown;
  readonly startTime: Date;
  readonly endTime?: Date;
  readonly status: SkillState;
  readonly error?: string;
}
