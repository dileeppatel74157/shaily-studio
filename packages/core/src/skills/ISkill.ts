import { SkillState } from "./SkillState";
import { SkillManifest } from "./SkillManifest";
import { SkillContext } from "./SkillContext";
import { SkillConfiguration } from "./SkillConfiguration";
import { SkillExecutionResult } from "./SkillExecutionResult";

export interface ISkill {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly state: SkillState;
  readonly manifest: SkillManifest;
  readonly context: SkillContext;
  readonly configuration?: SkillConfiguration;

  initialize(): Promise<void>;
  execute(input?: unknown): Promise<SkillExecutionResult>;
  stop(): Promise<void>;
}
