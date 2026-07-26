import { ISkill } from "../interfaces/ISkill";
import { SkillSnapshot } from "../models/SkillSnapshot";
import { SkillExecutionResult } from "../models/SkillExecutionResult";

export interface ISkillRegistry {
  register(skill: ISkill): Promise<void>;
  unregister(id: string): Promise<void>;
  update(skill: ISkill): Promise<void>;
  list(): ReadonlyArray<ISkill>;
  search(query: string): ReadonlyArray<ISkill>;
  get(id: string): ISkill | undefined;
  has(id: string): boolean;
  load(id: string): Promise<void>;
  unload(id: string): Promise<void>;
  reload(id: string): Promise<void>;
  execute(id: string, input?: unknown): Promise<SkillExecutionResult>;
  snapshot(): SkillSnapshot;
}
