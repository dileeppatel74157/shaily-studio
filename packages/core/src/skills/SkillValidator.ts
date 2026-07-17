import { SkillManifest } from "./SkillManifest";
import { SkillParameter } from "./SkillParameter";
import { SkillValidationException, SkillDependencyException } from "./types";
import { ISkill } from "./ISkill";
import { SkillVersion } from "./SkillVersion";

export class SkillValidator {
  public static validateManifest(manifest: SkillManifest): void {
    if (!manifest.metadata.id || manifest.metadata.id.trim() === "") {
      throw new SkillValidationException("Skill manifest metadata.id is required");
    }
    if (!manifest.metadata.name || manifest.metadata.name.trim() === "") {
      throw new SkillValidationException("Skill manifest metadata.name is required");
    }
    if (!manifest.metadata.version) {
      throw new SkillValidationException("Skill manifest metadata.version is required");
    }
  }

  public static validateParameters(parameters: ReadonlyArray<SkillParameter>, input: any): void {
    for (const param of parameters) {
      if (param.required) {
        if (
          input === undefined ||
          input === null ||
          input[param.name] === undefined ||
          input[param.name] === null
        ) {
          throw new SkillValidationException(`Missing required parameter: ${param.name}`);
        }
      }
      if (input && input[param.name] !== undefined) {
        const val = input[param.name];
        if (param.type === "string" && typeof val !== "string") {
          throw new SkillValidationException(`Parameter ${param.name} must be a string`);
        }
        if (param.type === "number" && typeof val !== "number") {
          throw new SkillValidationException(`Parameter ${param.name} must be a number`);
        }
        if (param.type === "boolean" && typeof val !== "boolean") {
          throw new SkillValidationException(`Parameter ${param.name} must be a boolean`);
        }
      }
    }
  }

  public static validateDependencies(skills: ReadonlyArray<ISkill>): void {
    // 1. Check duplicate IDs
    const ids = new Set<string>();
    for (const skill of skills) {
      if (ids.has(skill.id)) {
        throw new SkillValidationException(`Duplicate skill ID: ${skill.id}`);
      }
      ids.add(skill.id);
    }

    // 2. Dependency cycles & version compatibility
    const adjList = new Map<string, string[]>();
    const skillMap = new Map<string, ISkill>();

    for (const skill of skills) {
      skillMap.set(skill.id, skill);
      adjList.set(
        skill.id,
        skill.manifest.dependencies.map((d) => d.skillId)
      );

      // Version compatibility check
      for (const dep of skill.manifest.dependencies) {
        const target = skills.find((s) => s.id === dep.skillId);
        if (!target) {
          if (!dep.optional) {
            throw new SkillDependencyException(
              `Missing non-optional dependency: ${dep.skillId} for skill ${skill.id}`
            );
          }
        } else {
          const targetVer =
            typeof target.manifest.metadata.version === "string"
              ? SkillVersion.parse(target.manifest.metadata.version)
              : target.manifest.metadata.version;
          if (!targetVer.isCompatibleWith(dep.versionRange)) {
            throw new SkillDependencyException(
              `Incompatible dependency: ${
                dep.skillId
              } (${targetVer.toString()}) does not satisfy range ${
                dep.versionRange
              } for skill ${skill.id}`
            );
          }
        }
      }
    }

    // Cycle detection using DFS
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const checkCycle = (node: string) => {
      if (recStack.has(node)) {
        throw new SkillDependencyException(`Dependency cycle detected: path contains ${node}`);
      }
      if (!visited.has(node)) {
        visited.add(node);
        recStack.add(node);
        const neighbors = adjList.get(node) || [];
        for (const neighbor of neighbors) {
          if (skillMap.has(neighbor)) {
            checkCycle(neighbor);
          }
        }
        recStack.delete(node);
      }
    };

    for (const skill of skills) {
      checkCycle(skill.id);
    }
  }

  public static validatePermissions(required: string[], granted: string[]): void {
    for (const perm of required) {
      if (!granted.includes(perm)) {
        throw new SkillValidationException(`Missing required permission: ${perm}`);
      }
    }
  }
}
