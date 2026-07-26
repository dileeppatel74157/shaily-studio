import { IBaseAgent } from "./IBaseAgent";
import { AgentContext } from "../models/AgentContext";
import { AgentSnapshot } from "../models/AgentSnapshot";
import { AgentRole } from "../types/AgentRole";
import { AgentCapability } from "../types/AgentCapability";
import { AgentGoal } from "../models/AgentGoal";
import { AgentProfile } from "../models/AgentProfile";
import { AgentConfiguration } from "../types/AgentConfiguration";
import { ISkill } from "../skills/ISkill";

export interface IAgent extends IBaseAgent {
  readonly version: string;
  readonly role: AgentRole;
  readonly capabilities: ReadonlyArray<AgentCapability>;
  readonly goals: ReadonlyArray<AgentGoal>;
  readonly profile?: AgentProfile;
  readonly configuration?: AgentConfiguration;
  readonly metadata: Record<string, unknown>;
  readonly context: AgentContext;

  installSkill(skill: ISkill): Promise<void>;
  removeSkill(skillId: string): Promise<void>;
  enableSkill(skillId: string): Promise<void>;
  disableSkill(skillId: string): Promise<void>;
  executeSkill(skillId: string, input?: unknown): Promise<unknown>;
  listSkills(): ReadonlyArray<ISkill>;
  selectExecutionOption<T extends { id: string; name: string }>(
    type: any,
    options: T[],
    criteria?: any[]
  ): Promise<T>;

  shutdown(): Promise<void>;
}
