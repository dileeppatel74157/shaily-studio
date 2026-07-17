import { ISkillLoader } from "./ISkillLoader";
import { ISkill } from "./ISkill";
import { SkillContext } from "./SkillContext";
import { Skill } from "./Skill";
import { SkillManifest } from "./SkillManifest";
import { SkillValidator } from "./SkillValidator";
import * as fs from "fs";
import * as path from "path";

export class SkillLoader implements ISkillLoader {
  public async loadFromManifest(manifestPath: string, context: SkillContext): Promise<ISkill> {
    let manifestJson: any;
    try {
      const content = fs.readFileSync(manifestPath, "utf-8");
      manifestJson = JSON.parse(content);
    } catch (err: any) {
      throw new Error(`Failed to read manifest file: ${err.message}`);
    }

    const manifest: SkillManifest = manifestJson;
    SkillValidator.validateManifest(manifest);

    const dir = path.dirname(manifestPath);
    let executorFn: any;

    const possiblePaths = [
      path.join(dir, "index.js"),
      path.join(dir, "main.js"),
      path.join(dir, "skill.js"),
    ];

    let loaded = false;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        try {
          const module = require(p);
          executorFn = module.default || module.execute || module;
          loaded = true;
          break;
        } catch (e: any) {
          throw new Error(`Failed to dynamically import skill from ${p}: ${e.message}`);
        }
      }
    }

    if (!loaded || typeof executorFn !== "function") {
      executorFn = async (input?: any) => {
        context.logger.info(`Fallback executor running for skill ${manifest.metadata.id}`);
        return { status: "success", input };
      };
    }

    const skill = new Skill(manifest, context, executorFn);
    await skill.initialize();
    return skill;
  }

  public async loadDirectory(
    directoryPath: string,
    context: SkillContext
  ): Promise<ReadonlyArray<ISkill>> {
    const skills: ISkill[] = [];
    if (!fs.existsSync(directoryPath)) return [];

    const files = fs.readdirSync(directoryPath);
    for (const file of files) {
      const fullPath = path.join(directoryPath, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        const manifestPath = path.join(fullPath, "manifest.json");
        if (fs.existsSync(manifestPath)) {
          try {
            const skill = await this.loadFromManifest(manifestPath, context);
            skills.push(skill);
          } catch (e: any) {
            context.logger.error(`Failed to load skill in directory ${fullPath}: ${e.message}`);
          }
        }
      }
    }
    return skills;
  }
}
