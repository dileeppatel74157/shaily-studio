import { SkillParameter } from "./SkillParameter";

export interface SkillCapability {
  readonly name: string;
  readonly description: string;
  readonly parameters: ReadonlyArray<SkillParameter>;
}
