export interface SkillParameter {
  readonly name: string;
  readonly type: string;
  readonly description: string;
  readonly required: boolean;
  readonly default?: any;
}
