import { SkillType } from "./SkillType";
import { SkillScope } from "./SkillScope";
import { SkillVisibility } from "./SkillVisibility";
import { SkillVersion } from "./SkillVersion";
import { SkillAuthor } from "./SkillAuthor";

export interface SkillMetadata {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: SkillVersion | string;
  readonly author: SkillAuthor | string;
  readonly type: SkillType;
  readonly scope: SkillScope;
  readonly visibility: SkillVisibility;
  readonly tags: ReadonlyArray<string>;
  readonly metadata?: Record<string, unknown>;
}
