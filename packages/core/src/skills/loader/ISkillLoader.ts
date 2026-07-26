import { ISkill } from "../interfaces/ISkill";
import { SkillContext } from "../models/SkillContext";

export interface ISkillLoader {
  loadFromManifest(manifestPath: string, context: SkillContext): Promise<ISkill>;
  loadDirectory(directoryPath: string, context: SkillContext): Promise<ReadonlyArray<ISkill>>;
}
