export interface SkillDependency {
  readonly skillId: string;
  readonly versionRange: string;
  readonly optional?: boolean;
}
