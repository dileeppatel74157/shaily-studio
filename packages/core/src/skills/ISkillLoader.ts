import { ISkill } from "./ISkill";
import { SkillContext } from "./SkillContext";

export interface ISkillLoader {
  loadFromManifest(manifestPath: string, context: SkillContext): Promise<ISkill>;
  loadDirectory(directoryPath: string, context: SkillContext): Promise<ReadonlyArray<ISkill>>;
}
