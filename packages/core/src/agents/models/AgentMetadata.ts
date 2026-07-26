import { AgentRole } from "../types/AgentRole";
import { AgentCapability } from "../types/AgentCapability";
import { AgentGoal } from "./AgentGoal";
import { AgentProfile } from "./AgentProfile";
import { AgentConfiguration } from "../types/AgentConfiguration";

export interface AgentMetadata {
  readonly id: string;
  readonly name: string;
  readonly role: AgentRole;
  readonly version: string;
  readonly description: string;
  readonly capabilities: ReadonlyArray<AgentCapability>;
  readonly goals: ReadonlyArray<AgentGoal>;
  readonly profile?: AgentProfile;
  readonly configuration?: AgentConfiguration;
  readonly metadata: Record<string, unknown>;
}
