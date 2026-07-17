import { SkillState } from "./SkillState";
import { SkillManifest } from "./SkillManifest";

export interface SkillSnapshot {
  readonly timestamp: Date;
  readonly count: number;
  readonly skills: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly state: SkillState;
    readonly manifest: SkillManifest;
  }>;
}
