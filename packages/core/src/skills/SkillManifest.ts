import { SkillMetadata } from "./SkillMetadata";
import { SkillCapability } from "./SkillCapability";
import { SkillDependency } from "./SkillDependency";
import { SkillRequirement } from "./SkillRequirement";
import { SkillPermission } from "./SkillPermission";

export interface SkillManifest {
  readonly metadata: SkillMetadata;
  readonly capabilities: ReadonlyArray<SkillCapability>;
  readonly dependencies: ReadonlyArray<SkillDependency>;
  readonly requirements: ReadonlyArray<SkillRequirement>;
  readonly permissions: ReadonlyArray<SkillPermission>;
}
